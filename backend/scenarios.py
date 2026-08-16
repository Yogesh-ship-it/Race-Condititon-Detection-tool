"""
Preloaded Example Scenarios for RaceGuard
Defines buggy and mutex-fixed execution event logs for 4 concurrency scenarios:
1. Counter++ (Unsynchronized counter increments)
2. Bank Transfer (Partial synchronization - Sender locks, Receiver doesn't)
3. Producer-Consumer (Unsynchronized buffer & count access)
4. Reader-Writer (Unsynchronized data/version updates vs concurrent readers)
"""

from typing import Dict, Any, List

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "counter": {
        "id": "counter",
        "title": "Counter++",
        "subtitle": "Two threads incrementing a shared counter without synchronization",
        "description": "Demonstrates a classic write-write race causing a lost update. Both threads read and write to 'counter' concurrently with no common lock.",
        "variables": ["counter"],
        "buggy": [
            {"id": "c1", "thread_id": "Thread A", "variable_name": "counter", "operation": "read", "timestamp": 1, "locks_held": []},
            {"id": "c2", "thread_id": "Thread B", "variable_name": "counter", "operation": "read", "timestamp": 1, "locks_held": []},
            {"id": "c3", "thread_id": "Thread A", "variable_name": "counter", "operation": "write", "timestamp": 2, "locks_held": []},
            {"id": "c4", "thread_id": "Thread B", "variable_name": "counter", "operation": "write", "timestamp": 2, "locks_held": []}
        ],
        "fixed": [
            {"id": "cf1", "thread_id": "Thread A", "variable_name": "counter", "operation": "read", "timestamp": 1, "locks_held": ["counter_mutex"]},
            {"id": "cf2", "thread_id": "Thread A", "variable_name": "counter", "operation": "write", "timestamp": 2, "locks_held": ["counter_mutex"]},
            {"id": "cf3", "thread_id": "Thread B", "variable_name": "counter", "operation": "read", "timestamp": 3, "locks_held": ["counter_mutex"]},
            {"id": "cf4", "thread_id": "Thread B", "variable_name": "counter", "operation": "write", "timestamp": 4, "locks_held": ["counter_mutex"]}
        ]
    },
    "bank_transfer": {
        "id": "bank_transfer",
        "title": "Bank Transfer",
        "subtitle": "Sender acquires lock before updating balance, receiver reads without locking",
        "description": "Demonstrates partial/inconsistent synchronization. Sender holds 'balance_lock' while updating, but Receiver reads 'balance' without acquiring any lock.",
        "variables": ["balance"],
        "buggy": [
            {"id": "bt1", "thread_id": "Sender Thread", "variable_name": "balance", "operation": "read", "timestamp": 1, "locks_held": ["balance_lock"]},
            {"id": "bt2", "thread_id": "Sender Thread", "variable_name": "balance", "operation": "write", "timestamp": 2, "locks_held": ["balance_lock"]},
            {"id": "bt3", "thread_id": "Receiver Thread", "variable_name": "balance", "operation": "read", "timestamp": 2, "locks_held": []},
            {"id": "bt4", "thread_id": "Receiver Thread", "variable_name": "balance", "operation": "read", "timestamp": 3, "locks_held": []}
        ],
        "fixed": [
            {"id": "btf1", "thread_id": "Sender Thread", "variable_name": "balance", "operation": "read", "timestamp": 1, "locks_held": ["balance_lock"]},
            {"id": "btf2", "thread_id": "Sender Thread", "variable_name": "balance", "operation": "write", "timestamp": 2, "locks_held": ["balance_lock"]},
            {"id": "btf3", "thread_id": "Receiver Thread", "variable_name": "balance", "operation": "read", "timestamp": 3, "locks_held": ["balance_lock"]},
            {"id": "btf4", "thread_id": "Receiver Thread", "variable_name": "balance", "operation": "read", "timestamp": 4, "locks_held": ["balance_lock"]}
        ]
    },
    "producer_consumer": {
        "id": "producer_consumer",
        "title": "Producer / Consumer",
        "subtitle": "Unsynchronized buffer writes and item count updates",
        "description": "Producer writes to 'buffer' and increments 'count'; Consumer reads 'buffer' and decrements 'count'. Without synchronization, races occur on both shared variables.",
        "variables": ["buffer", "count"],
        "buggy": [
            {"id": "pc1", "thread_id": "Producer", "variable_name": "buffer", "operation": "write", "timestamp": 1, "locks_held": []},
            {"id": "pc2", "thread_id": "Consumer", "variable_name": "buffer", "operation": "read", "timestamp": 1, "locks_held": []},
            {"id": "pc3", "thread_id": "Producer", "variable_name": "count", "operation": "read", "timestamp": 2, "locks_held": []},
            {"id": "pc4", "thread_id": "Consumer", "variable_name": "count", "operation": "read", "timestamp": 2, "locks_held": []},
            {"id": "pc5", "thread_id": "Producer", "variable_name": "count", "operation": "write", "timestamp": 3, "locks_held": []},
            {"id": "pc6", "thread_id": "Consumer", "variable_name": "count", "operation": "write", "timestamp": 3, "locks_held": []}
        ],
        "fixed": [
            {"id": "pcf1", "thread_id": "Producer", "variable_name": "buffer", "operation": "write", "timestamp": 1, "locks_held": ["buffer_lock"]},
            {"id": "pcf2", "thread_id": "Producer", "variable_name": "count", "operation": "read", "timestamp": 2, "locks_held": ["count_lock"]},
            {"id": "pcf3", "thread_id": "Producer", "variable_name": "count", "operation": "write", "timestamp": 3, "locks_held": ["count_lock"]},
            {"id": "pcf4", "thread_id": "Consumer", "variable_name": "buffer", "operation": "read", "timestamp": 4, "locks_held": ["buffer_lock"]},
            {"id": "pcf5", "thread_id": "Consumer", "variable_name": "count", "operation": "read", "timestamp": 5, "locks_held": ["count_lock"]},
            {"id": "pcf6", "thread_id": "Consumer", "variable_name": "count", "operation": "write", "timestamp": 6, "locks_held": ["count_lock"]}
        ]
    },
    "reader_writer": {
        "id": "reader_writer",
        "title": "Reader / Writer",
        "subtitle": "One writer modifying data & version while readers access concurrently",
        "description": "Readers reading simultaneously are safe among themselves, but the writer modifying 'data' and 'version' while readers are active creates Read-Write and Write-Read races.",
        "variables": ["data", "version"],
        "buggy": [
            {"id": "rw1", "thread_id": "Reader 1", "variable_name": "data", "operation": "read", "timestamp": 1, "locks_held": []},
            {"id": "rw2", "thread_id": "Reader 2", "variable_name": "data", "operation": "read", "timestamp": 1, "locks_held": []},
            {"id": "rw3", "thread_id": "Writer", "variable_name": "data", "operation": "write", "timestamp": 2, "locks_held": []},
            {"id": "rw4", "thread_id": "Reader 1", "variable_name": "version", "operation": "read", "timestamp": 2, "locks_held": []},
            {"id": "rw5", "thread_id": "Writer", "variable_name": "version", "operation": "write", "timestamp": 3, "locks_held": []},
            {"id": "rw6", "thread_id": "Reader 2", "variable_name": "version", "operation": "read", "timestamp": 3, "locks_held": []}
        ],
        "fixed": [
            {"id": "rwf1", "thread_id": "Writer", "variable_name": "data", "operation": "write", "timestamp": 1, "locks_held": ["rw_mutex"]},
            {"id": "rwf2", "thread_id": "Writer", "variable_name": "version", "operation": "write", "timestamp": 2, "locks_held": ["rw_mutex"]},
            {"id": "rwf3", "thread_id": "Reader 1", "variable_name": "data", "operation": "read", "timestamp": 3, "locks_held": ["rw_mutex"]},
            {"id": "rwf4", "thread_id": "Reader 1", "variable_name": "version", "operation": "read", "timestamp": 4, "locks_held": ["rw_mutex"]},
            {"id": "rwf5", "thread_id": "Reader 2", "variable_name": "data", "operation": "read", "timestamp": 5, "locks_held": ["rw_mutex"]},
            {"id": "rwf6", "thread_id": "Reader 2", "variable_name": "version", "operation": "read", "timestamp": 6, "locks_held": ["rw_mutex"]}
        ]
    }
}


def get_scenario(scenario_id: str, is_fixed: bool = False) -> Dict[str, Any]:
    sc = SCENARIOS.get(scenario_id, SCENARIOS["counter"])
    events = sc["fixed"] if is_fixed else sc["buggy"]
    return {
        "id": sc["id"],
        "title": sc["title"],
        "subtitle": sc["subtitle"],
        "description": sc["description"],
        "variables": sc["variables"],
        "is_fixed": is_fixed,
        "events": events
    }
