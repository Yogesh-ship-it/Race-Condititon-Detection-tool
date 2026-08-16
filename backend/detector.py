"""
RaceGuard Detection Engine
Implements Eraser (Lockset Algorithm) and Bernstein's Conditions analysis
for simulated multi-threaded execution access logs.
"""

from typing import List, Dict, Any, Set, Tuple

class RaceDetector:
    """
    Analyzes simulated thread execution logs to detect race conditions
    using Bernstein's Conditions and the Eraser / Lockset Algorithm.
    """

    def __init__(self, events: List[Dict[str, Any]]):
        """
        :param events: List of event dicts:
            {
                "id": str|int,
                "thread_id": str,
                "variable_name": str,
                "operation": "read" | "write" (case insensitive),
                "timestamp": int,
                "locks_held": List[str]
            }
        """
        self.raw_events = events
        self.events = self._normalize_events(events)

    def _normalize_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        for i, ev in enumerate(events):
            op = str(ev.get("operation", "read")).lower().strip()
            if op not in ("read", "write"):
                op = "read"
            
            locks = ev.get("locks_held", [])
            if isinstance(locks, str):
                locks = [l.strip() for l in locks.split(",") if l.strip()]
            elif not isinstance(locks, list):
                locks = []
            
            normalized.append({
                "id": ev.get("id", f"ev_{i+1}"),
                "thread_id": str(ev.get("thread_id", f"Thread_{i+1}")).strip(),
                "variable_name": str(ev.get("variable_name", "var")).strip(),
                "operation": op,
                "timestamp": int(ev.get("timestamp", i + 1)),
                "locks_held": [str(l).strip() for l in locks if str(l).strip()]
            })
        return normalized

    def analyze(self) -> Dict[str, Any]:
        """
        Executes full lockset and Bernstein race analysis.
        Returns detailed report and heat map visualization data.
        """
        if not self.events:
            return self._empty_result()

        # Extract unique variables, threads, timestamps
        variables = sorted(list(set(e["variable_name"] for e in self.events)))
        threads = sorted(list(set(e["thread_id"] for e in self.events)))
        timestamps = sorted(list(set(e["timestamp"] for e in self.events)))
        if not timestamps:
            timestamps = [1]

        # 1. Eraser Lockset analysis per variable
        lockset_results = self._analyze_locksets(variables)

        # 2. Bernstein's conditions pairwise conflict detection
        detected_races, race_event_ids = self._detect_pairwise_races(lockset_results)

        # 3. Summary metrics
        critical_count = sum(1 for r in detected_races if r["conflict_type"] == "CRITICAL")
        warning_count = sum(1 for r in detected_races if r["conflict_type"] == "WARNING")
        
        affected_vars = sorted(list(set(r["variable_name"] for r in detected_races)))
        involved_threads = sorted(list(set(t for r in detected_races for t in r["threads"])))

        # 4. Generate Heatmap matrix
        heatmap_data = self._generate_heatmap(variables, timestamps, race_event_ids, detected_races)

        # 5. Simulate Variable Memory State Evolution
        variable_states = self._simulate_variable_states(variables, timestamps, detected_races)

        return {
            "summary": {
                "total_races": len(detected_races),
                "critical_count": critical_count,
                "warning_count": warning_count,
                "safe_count": len([r for r in detected_races if r["conflict_type"] == "SAFE"]),
                "variables_affected_count": len(affected_vars),
                "variables_affected": affected_vars,
                "threads_involved_count": len(involved_threads),
                "threads_involved": involved_threads,
                "total_events": len(self.events)
            },
            "races": detected_races,
            "locksets": lockset_results,
            "heatmap": heatmap_data,
            "variable_states": variable_states
        }

    def _analyze_locksets(self, variables: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Runs Eraser / Lockset candidate intersection per variable.
        C(v) starts with locks held on first access, then C(v) = C(v) ∩ locks_held(access).
        """
        lockset_summary = {}

        for var in variables:
            var_events = [e for e in self.events if e["variable_name"] == var]
            var_events.sort(key=lambda x: x["timestamp"])

            candidate_locks: Set[str] = set()
            history = []
            has_write = False
            first_access = True

            for ev in var_events:
                locks = set(ev["locks_held"])
                if ev["operation"] == "write":
                    has_write = True

                if first_access:
                    candidate_locks = set(locks)
                    first_access = False
                else:
                    candidate_locks = candidate_locks.intersection(locks)

                history.append({
                    "timestamp": ev["timestamp"],
                    "thread_id": ev["thread_id"],
                    "locks_held": list(locks),
                    "candidate_locks_after": list(candidate_locks)
                })

            lockset_summary[var] = {
                "final_candidate_locks": list(candidate_locks),
                "has_common_lock": len(candidate_locks) > 0,
                "has_write_operation": has_write,
                "lockset_violation": (len(candidate_locks) == 0) and has_write and (len(set(e["thread_id"] for e in var_events)) > 1),
                "history": history
            }

        return lockset_summary

    def _detect_pairwise_races(self, lockset_results: Dict[str, Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
        """
        Evaluates Bernstein's Conditions across pairs of events from different threads
        accessing the same shared variable.
        """
        races = []
        race_event_ids: Dict[str, str] = {}  # event_id -> highest severity ("CRITICAL" / "WARNING")

        # Group events by variable
        var_groups: Dict[str, List[Dict[str, Any]]] = {}
        for ev in self.events:
            var = ev["variable_name"]
            var_groups.setdefault(var, []).append(ev)

        race_counter = 1

        for var, events in var_groups.items():
            # Compare every pair of events on this variable
            n = len(events)
            for i in range(n):
                for j in range(i + 1, n):
                    ev1 = events[i]
                    ev2 = events[j]

                    # Must be from different threads
                    if ev1["thread_id"] == ev2["thread_id"]:
                        continue

                    # At least one must be a WRITE for a race condition
                    op1 = ev1["operation"]
                    op2 = ev2["operation"]
                    if op1 == "read" and op2 == "read":
                        continue

                    # Check concurrency condition:
                    # In discrete step simulation, operations at the same timestamp OR adjacent steps
                    # without common locks represent concurrent window.
                    ts_diff = abs(ev1["timestamp"] - ev2["timestamp"])
                    is_concurrent = ts_diff <= 1

                    # Check common lock protection between these two specific access steps
                    locks1 = set(ev1["locks_held"])
                    locks2 = set(ev2["locks_held"])
                    common_locks = locks1.intersection(locks2)
                    has_common_lock = len(common_locks) > 0

                    # Race condition exists if concurrent (or no enforced sync) and NO common lock held!
                    if is_concurrent and not has_common_lock:
                        # Determine conflict type according to requirements
                        if op1 == "write" and op2 == "write":
                            conflict_type = "CRITICAL"
                            risk = "Write-Write conflict (Lost update / Data corruption risk)"
                            op_pair = "WRITE - WRITE"
                        else:
                            conflict_type = "WARNING"
                            risk = f"{op1.upper()}-{op2.upper()} conflict (Inconsistent read / Dirty read risk)"
                            op_pair = f"{op1.upper()} - {op2.upper()}"

                        # Craft diagnostic explanation based on lock status
                        if not locks1 and not locks2:
                            lock_desc = "Neither thread acquired any lock."
                        elif not locks1:
                            lock_desc = f"{ev2['thread_id']} held lock [{', '.join(locks2)}], but {ev1['thread_id']} was unlocked."
                        elif not locks2:
                            lock_desc = f"{ev1['thread_id']} held lock [{', '.join(locks1)}], but {ev2['thread_id']} was unlocked."
                        else:
                            lock_desc = f"{ev1['thread_id']} held [{', '.join(locks1)}] while {ev2['thread_id']} held [{', '.join(locks2)}] — no common mutex."

                        explanation = (
                            f"Race on variable '{var}': {ev1['thread_id']} ({ev1['operation'].upper()} at step {ev1['timestamp']}) "
                            f"and {ev2['thread_id']} ({ev2['operation'].upper()} at step {ev2['timestamp']}) accessed shared memory "
                            f"concurrently without mutual exclusion. {lock_desc} {risk}."
                        )

                        race_item = {
                            "id": f"RACE_{race_counter}",
                            "variable_name": var,
                            "threads": [ev1["thread_id"], ev2["thread_id"]],
                            "conflict_type": conflict_type,
                            "operation_pair": op_pair,
                            "timestamps": [ev1["timestamp"], ev2["timestamp"]],
                            "event_ids": [ev1["id"], ev2["id"]],
                            "algorithms": ["Bernstein's Conditions", "Eraser Lockset Algorithm"],
                            "common_locks": list(common_locks),
                            "explanation": explanation,
                            "risk": risk
                        }
                        races.append(race_item)
                        race_counter += 1

                        # Mark event IDs with race severity
                        for eid in [ev1["id"], ev2["id"]]:
                            current_sev = race_event_ids.get(eid)
                            if conflict_type == "CRITICAL" or current_sev != "CRITICAL":
                                race_event_ids[eid] = conflict_type

        return races, race_event_ids

    def _generate_heatmap(
        self,
        variables: List[str],
        timestamps: List[int],
        race_event_ids: Dict[str, str],
        races: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Constructs grid matrix mapping shared variables (rows) x time steps (columns).
        """
        # Ensure timestamp list is contiguous from min to max (e.g., 1..N)
        if timestamps:
            min_t = min(timestamps)
            max_t = max(timestamps)
            all_steps = list(range(min_t, max_t + 1))
        else:
            all_steps = [1]

        grid: Dict[str, Dict[int, List[Dict[str, Any]]]] = {var: {step: [] for step in all_steps} for var in variables}

        for ev in self.events:
            var = ev["variable_name"]
            step = ev["timestamp"]
            if var in grid and step in grid[var]:
                sev = race_event_ids.get(ev["id"], "SAFE")
                grid[var][step].append({
                    "id": ev["id"],
                    "thread_id": ev["thread_id"],
                    "operation": ev["operation"].upper(),
                    "locks_held": ev["locks_held"],
                    "severity": sev,
                    "is_race": sev in ("CRITICAL", "WARNING")
                })

        return {
            "variables": variables,
            "timestamps": all_steps,
            "grid": grid
        }

    def _simulate_variable_states(
        self,
        variables: List[str],
        timestamps: List[int],
        detected_races: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Simulates values for each variable over execution steps.
        Tracks actual value vs expected synchronized value to demonstrate
        Lost Updates and Stale/Dirty Reads.
        """
        if not timestamps:
            all_steps = [1]
        else:
            all_steps = list(range(min(timestamps), max(timestamps) + 1))

        # Identify which steps have critical or warning races per variable
        race_map: Dict[str, Dict[int, str]] = {}
        for r in detected_races:
            var = r["variable_name"]
            c_type = r["conflict_type"]
            for ts in r["timestamps"]:
                race_map.setdefault(var, {})
                if c_type == "CRITICAL" or race_map[var].get(ts) != "CRITICAL":
                    race_map[var][ts] = c_type

        simulation: Dict[str, Dict[str, Any]] = {}

        for var in variables:
            # Set domain initial value
            init_val = 1000 if "balance" in var.lower() else 0
            curr_actual = init_val
            curr_expected = init_val

            var_events = [e for e in self.events if e["variable_name"] == var]
            steps_history = []
            has_divergence = False

            for step in all_steps:
                step_events = [e for e in var_events if e["timestamp"] == step]
                step_race_type = race_map.get(var, {}).get(step)

                reads = [e for e in step_events if e["operation"] == "read"]
                writes = [e for e in step_events if e["operation"] == "write"]

                is_corrupted = False
                anomaly_type = "SYNCHRONIZED"
                explanation = "Memory access is synchronized and consistent."

                if not step_events:
                    anomaly_type = "IDLE"
                    explanation = "No memory access operations on this step."
                else:
                    # Increment delta per write operation (default +1 for counter, +100 for balance, +1 for buffer/count)
                    write_delta = 100 if "balance" in var.lower() else 1

                    # Expected value assumes serialized / synchronized updates
                    curr_expected += len(writes) * write_delta

                    if step_race_type == "CRITICAL":
                        # Write-Write Conflict: Lost update!
                        # Multiple concurrent writes read same initial value, resulting in only 1 write sticking
                        curr_actual += write_delta
                        is_corrupted = True
                        has_divergence = True
                        anomaly_type = "LOST_UPDATE"
                        explanation = (
                            f"⚠️ LOST UPDATE DETECTED! {len(writes)} threads performed unsynchronized concurrent WRITEs. "
                            f"Both read initial value {curr_actual - write_delta}, so only one update survived. "
                            f"Actual: {curr_actual} | Expected: {curr_expected}."
                        )
                    elif step_race_type == "WARNING":
                        # Read-Write Conflict: Dirty/Stale read
                        if writes:
                            curr_actual += len(writes) * write_delta
                        is_corrupted = True
                        has_divergence = True
                        anomaly_type = "DIRTY_READ"
                        explanation = (
                            f"⚠️ STALE/DIRTY READ DETECTED! A thread executed a READ while a WRITE was occurring concurrently "
                            f"without mutual exclusion lock protection."
                        )
                    else:
                        # Safe/Synchronized access
                        if writes:
                            curr_actual += len(writes) * write_delta

                steps_history.append({
                    "step": step,
                    "actual_value": curr_actual,
                    "expected_value": curr_expected,
                    "is_corrupted": is_corrupted,
                    "anomaly_type": anomaly_type,
                    "explanation": explanation,
                    "operations": [
                        {
                            "thread_id": e["thread_id"],
                            "op": e["operation"].upper(),
                            "locks_held": e["locks_held"]
                        } for e in step_events
                    ]
                })

            simulation[var] = {
                "initial_value": init_val,
                "final_actual": curr_actual,
                "final_expected": curr_expected,
                "has_divergence": has_divergence,
                "steps": steps_history
            }

        return simulation

    def _empty_result(self) -> Dict[str, Any]:
        return {
            "summary": {
                "total_races": 0,
                "critical_count": 0,
                "warning_count": 0,
                "safe_count": 0,
                "variables_affected_count": 0,
                "variables_affected": [],
                "threads_involved_count": 0,
                "threads_involved": [],
                "total_events": 0
            },
            "races": [],
            "locksets": {},
            "heatmap": {"variables": [], "timestamps": [], "grid": {}},
            "variable_states": {}
        }

