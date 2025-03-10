from dagster import EnvVar

from data_pipeline.resources.batch_inference.base_llm_resource import BaseLlmResource
from data_pipeline.resources.batch_inference.llm_factory import (
    LlmConfig,
    create_llm_resource,
)
from data_pipeline.resources.batch_inference.local_llm_config import LocalLlmConfig
from data_pipeline.resources.batch_inference.remote_llm_config import RemoteLlmConfig

gemma9b_config = LlmConfig(
    colloquial_model_name="gemma9b",
    local_llm_config=LocalLlmConfig(
        model_name="google/gemma-2-9b-it",
        sampling_params_args={
            "temperature": 1.0,
            "top_p": 1.0,
            "max_tokens": 1024,
        },
        vllm_args={
            "enforce_eager": True,
            "tensor_parallel_size": 1,
        },
    ),
    remote_llm_config=RemoteLlmConfig(
        api_key=EnvVar("DEEPINFRA_API_KEY"),
        concurrency_limit=200,
        timeout=60 * 5,
        inference_url="https://api.deepinfra.com/v1/openai/chat/completions",
        inference_config={"model": "google/gemma-2-9b-it"},
        input_cpm=0.06,
        output_cpm=0.06,
        context_length=8192,
    ),
)


def create_gemma9b_resource() -> BaseLlmResource:
    return create_llm_resource(gemma9b_config)
