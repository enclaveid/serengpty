import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Callable

import httpx
from dagster import InitResourceContext, get_dagster_logger
from pydantic import PrivateAttr

from data_pipeline.resources.batch_inference.api_keys import get_gemini_api_key
from data_pipeline.resources.batch_inference.base_llm_resource import (
    BaseLlmResource,
    PromptSequence,
)
from data_pipeline.resources.batch_inference.remote_llm_config import RemoteLlmConfig


@dataclass
class SequenceMetrics:
    start_time: float
    duration: float | None = None
    input_tokens: int = 0
    output_tokens: int = 0


class RemoteLlmResource(BaseLlmResource):
    llm_config: RemoteLlmConfig
    is_multimodal: bool = False

    _client: httpx.AsyncClient = PrivateAttr()
    _retry_event: asyncio.Event = PrivateAttr(default_factory=asyncio.Event)
    _remaining_reqs: int = PrivateAttr()
    _loop: asyncio.AbstractEventLoop = PrivateAttr()
    _sequence_metrics: dict[int, SequenceMetrics] = PrivateAttr(default_factory=dict)
    _retry_count: int = PrivateAttr(default=0)

    def _create_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            limits=httpx.Limits(
                max_connections=self.llm_config.concurrency_limit,
                max_keepalive_connections=self.llm_config.concurrency_limit,
            ),
            timeout=self.llm_config.timeout,
        )

    def setup_for_execution(self, context: InitResourceContext) -> None:
        self._client = self._create_client()
        self._retry_event.set()  # Initially allow all operations
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

    async def _periodic_status_printer(self) -> None:
        logger = get_dagster_logger()
        while True:
            # Only consider completed sequences (those with duration set)
            completed_metrics = [
                m for m in self._sequence_metrics.values() if m.duration is not None
            ]

            log_mgs = f"{self._remaining_reqs} requests remaining"

            if completed_metrics:
                avg_duration = sum(m.duration for m in completed_metrics) / len(
                    completed_metrics
                )
                avg_input_tokens = sum(m.input_tokens for m in completed_metrics) / len(
                    completed_metrics
                )
                avg_output_tokens = sum(
                    m.output_tokens for m in completed_metrics
                ) / len(completed_metrics)

                log_mgs += (
                    f" | Avg seq duration: {avg_duration:.2f}s | Avg seq in tokens: {avg_input_tokens:.1f} "
                    f"| Avg seq out tokens: {avg_output_tokens:.1f}"
                )

            if self._retry_count:
                log_mgs += f" | Total retries: {self._retry_count}"
                # Optionally, you can reset the counter after logging:
                self._retry_count = 0

            logger.info(log_mgs)
            await asyncio.sleep(60)

    async def _get_completion(
        self,
        conversation: list[dict[str, str]],
        conversation_id: int,
    ) -> tuple[str | None, float, tuple[int, int]]:
        # If a message has with_memory set to False, remove all previous messages from the payload
        conversation_payload = [
            {"role": msg["role"], "content": msg["content"]}
            for i, msg in enumerate(conversation)
            if msg.get("with_memory", True) or i == len(conversation) - 1
        ]

        # TODO: Ensure payload fits the context window
        payload = {
            "messages": conversation_payload,
            **self.llm_config.inference_config,
        }

        if self.llm_config.provider:
            payload["provider"] = self.llm_config.provider

        # Requests are attempted in seuqnence, meaning that the latter
        # will likely be blocked more often
        max_attempts = conversation_id + 8
        logger = get_dagster_logger()

        for _ in range(max_attempts):
            await self._retry_event.wait()  # Wait if currently in retry mode
            response = None

            try:
                # Start with default headers
                if ".googleapis." in self.llm_config.inference_url:
                    api_key = get_gemini_api_key(self.llm_config.api_key)
                else:
                    api_key = self.llm_config.api_key

                headers = {
                    "Content-Type": "application/json",
                    # We need both because of inconsistencies across providers
                    "Authorization": f"Bearer {api_key}",
                    "api-key": api_key,
                }

                response = await self._client.post(
                    self.llm_config.inference_url,
                    json=payload,
                    headers=headers,
                )

                # Providers often return 500s for rate limits
                if response.status_code == 429 or response.status_code >= 500:
                    retry_after = response.headers.get("Retry-After") or (2**_)
                    # Increment the retry counter instead of logging an info message for each request
                    self._retry_count += 1
                    logger.debug(
                        f"LLM completion #{conversation_id} got status {response.status_code}. Retrying in {retry_after}s..."
                    )
                    wait_time = int(retry_after)
                    self._retry_event.clear()  # Block further requests
                    await asyncio.sleep(wait_time)  # Wait as advised by the server
                    self._retry_event.set()  # Allow requests again
                    continue

                response.raise_for_status()
                res = response.json()
                answer: str = res["choices"][0]["message"]["content"]
                input_tokens = res["usage"]["prompt_tokens"]
                output_tokens = res["usage"]["completion_tokens"]

                cost = (input_tokens * self.llm_config.input_cpm / 1_000_000) + (
                    output_tokens * self.llm_config.output_cpm / 1_000_000
                )
                return answer, cost, (input_tokens, output_tokens)

            except (httpx.TimeoutException, httpx.ReadError) as e:
                logger.error(f"LLM completion #{conversation_id} timed out: {e}")
                return None, 0, (0, 0)
            except Exception as e:
                if response:
                    logger.error(
                        f"LLM completion #{conversation_id} returned status code {response.status_code}: {response.text}"
                    )
                else:
                    logger.error(f"Error in LLM completion #{conversation_id}: {e}")

                return None, 0, (0, 0)

        logger.error(
            f"Failed to get completion #{conversation_id} after {max_attempts} attempts."
        )
        return None, 0, (0, 0)

    async def _get_prompt_sequence_completion(
        self, prompts_sequence: PromptSequence, conversation_id: int
    ) -> tuple[list[dict[str, str]], float]:
        self._sequence_metrics[conversation_id] = SequenceMetrics(
            start_time=time.time()
        )
        conversation = []
        total_cost = 0.0

        for prompt in prompts_sequence:
            with_memory = True
            if callable(prompt):
                content = prompt(conversation[-1]["content"])
                # We reset the "memory" when the prompt is a callable
                # since we carry over just the last response as parameter
                with_memory = False
            else:
                content = prompt

            conversation.append(
                {
                    "role": "user",
                    "content": [{"type": "text", "text": content}]
                    if self.is_multimodal
                    else content,
                    "with_memory": with_memory,
                }
            )
            response, cost, (input_tokens, output_tokens) = await self._get_completion(
                conversation, conversation_id
            )
            self._remaining_reqs -= 1

            if not response:
                return [], total_cost

            conversation.append({"role": "assistant", "content": response})
            metrics = self._sequence_metrics[conversation_id]
            metrics.input_tokens += input_tokens
            metrics.output_tokens += output_tokens
            total_cost += cost

        # Store final duration
        metrics = self._sequence_metrics[conversation_id]
        metrics.duration = time.time() - metrics.start_time

        return conversation, total_cost

    async def get_prompt_sequences_completions_batch_async(
        self, prompt_sequences: list[PromptSequence]
    ) -> tuple[list[list[str]], float]:
        """
        This method is used to get completions for multiple prompt sequences in parallel.
        Prompt sequence items (other than the first in the list) can be callables that take
        the previous assistant response as input and return the next user prompt based on custom logic
        """
        self._remaining_reqs = len(prompt_sequences) * len(prompt_sequences[0])
        self._status_printer_task = asyncio.create_task(self._periodic_status_printer())

        results = await asyncio.gather(
            *(
                self._get_prompt_sequence_completion(prompt_sequence, i)
                for i, prompt_sequence in enumerate(prompt_sequences)
            )
        )

        self._status_printer_task.cancel()

        conversations = [conv for conv, cost in results]
        costs = [cost for conv, cost in results]

        # Assume all prompt sequences have the same length
        prompt_sequences_length = max(len(sequence) for sequence in prompt_sequences)

        # Return all the assistant responses, only for completed conversations
        return list(
            map(
                lambda x: [message["content"] for message in x[1::2]]
                if len(x) == prompt_sequences_length * 2
                else [],
                conversations,
            )
        ), sum(costs)


    async def teardown_after_execution(self, context: InitResourceContext) -> None:
        await self._client.aclose()
        self._loop.close()
