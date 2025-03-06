"""Data loading utilities for conversation assets."""

from dagster import AssetExecutionContext


def get_materialized_partitions(context: AssetExecutionContext, asset_name: str):
    """Retrieve only currently active (non-deleted) partitions for a given asset."""
    # Fetch all materialized partitions
    materialized_partitions = context.instance.get_materialized_partitions(
        context.asset_key_for_input(asset_name)
    )
    # Fetch current dynamic partitions
    current_dynamic_partitions = context.instance.get_dynamic_partitions("users")
    # Filter out deleted partitions
    filtered_partitions = [
        partition
        for partition in materialized_partitions
        if partition in current_dynamic_partitions
    ]
    return filtered_partitions
