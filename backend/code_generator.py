"""
RaceGuard Code Generator Engine
Generates clean, compilable, and runnable C (POSIX pthreads) and Python (threading)
source code from execution traces to demonstrate race conditions and mutex synchronization natively.
"""

from typing import List, Dict, Any, Set
import re

def sanitize_identifier(name: str) -> str:
    """Sanitizes strings to valid C/Python variable identifiers."""
    cleaned = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    if cleaned and cleaned[0].isdigit():
        cleaned = '_' + cleaned
    return cleaned.lower()

class CodeGenerator:
    @staticmethod
    def generate_all(events: List[Dict[str, Any]], variables: List[str], is_fixed: bool = False) -> Dict[str, Any]:
        c_code = CodeGenerator.generate_c_pthreads(events, variables, is_fixed)
        py_code = CodeGenerator.generate_python_threading(events, variables, is_fixed)
        return {
            "c_code": c_code,
            "python_code": py_code,
            "c_instructions": "gcc -pthread race_demo.c -o race_demo && ./race_demo",
            "py_instructions": "python race_demo.py"
        }

    @staticmethod
    def generate_c_pthreads(events: List[Dict[str, Any]], variables: List[str], is_fixed: bool = False) -> str:
        lines = []
        lines.append("/*")
        lines.append(" * RaceGuard Concurrency Demonstration - C (POSIX pthreads)")
        lines.append(f" * Mode: {'MUTEX FIXED (Synchronized)' if is_fixed else 'BUGGY (Race Condition Present)'}")
        lines.append(" * Compile & Run: gcc -pthread race_demo.c -o race_demo && ./race_demo")
        lines.append(" */")
        lines.append("")
        lines.append("#include <stdio.h>")
        lines.append("#include <stdlib.h>")
        lines.append("#include <pthread.h>")
        lines.append("#include <unistd.h>")
        lines.append("")

        # Extract all unique locks used
        all_locks: Set[str] = set()
        for e in events:
            for l in e.get("locks_held", []):
                all_locks.add(sanitize_identifier(l))

        # Shared Variables
        lines.append("/* Shared Global Variables */")
        for var in variables:
            s_var = sanitize_identifier(var)
            init_val = 1000 if "balance" in s_var else 0
            lines.append(f"int {s_var} = {init_val};")
        lines.append("")

        # Mutex Declaration
        lines.append("/* POSIX Mutex Locks */")
        if not all_locks and is_fixed:
            all_locks.add("global_mutex")
        for lock in sorted(list(all_locks)):
            lines.append(f"pthread_mutex_t {lock} = PTHREAD_MUTEX_INITIALIZER;")
        lines.append("")

        # Group events by thread
        threads_map: Dict[str, List[Dict[str, Any]]] = {}
        for e in events:
            t_name = e.get("thread_id", "Thread_1")
            threads_map.setdefault(t_name, []).append(e)

        # Thread Functions
        for t_name, t_events in threads_map.items():
            func_name = f"{sanitize_identifier(t_name)}_runner"
            lines.append(f"/* Runner function for {t_name} */")
            lines.append(f"void* {func_name}(void* arg) {{")
            
            # Local registers for reads
            local_vars: Set[str] = set()
            for ev in t_events:
                s_var = sanitize_identifier(ev.get("variable_name", "var"))
                local_vars.add(f"local_{s_var}")
            for lv in sorted(list(local_vars)):
                lines.append(f"    int {lv} = 0;")

            # Sort by timestamp
            sorted_events = sorted(t_events, key=lambda x: x.get("timestamp", 1))
            active_locks: Set[str] = set()

            for ev in sorted_events:
                s_var = sanitize_identifier(ev.get("variable_name", "var"))
                op = ev.get("operation", "read").lower()
                locks = [sanitize_identifier(l) for l in ev.get("locks_held", [])]
                ts = ev.get("timestamp", 1)

                lines.append(f"    /* Step t{ts}: {op.upper()} on {s_var} */")

                # Lock acquisition
                for l in locks:
                    if l not in active_locks:
                        lines.append(f"    pthread_mutex_lock(&{l});")
                        active_locks.add(l)

                if op == "read":
                    lines.append(f"    local_{s_var} = {s_var};")
                    lines.append(f"    printf(\"[{t_name}] Read {s_var} = %d\\n\", local_{s_var});")
                elif op == "write":
                    delta = "100" if "balance" in s_var else "1"
                    lines.append(f"    local_{s_var} = local_{s_var} + {delta};")
                    lines.append(f"    {s_var} = local_{s_var};")
                    lines.append(f"    printf(\"[{t_name}] Wrote {s_var} = %d\\n\", {s_var});")
                elif op == "lock":
                    for l in locks:
                        if l not in active_locks:
                            lines.append(f"    pthread_mutex_lock(&{l});")
                            active_locks.add(l)
                elif op == "unlock":
                    for l in locks:
                        if l in active_locks:
                            lines.append(f"    pthread_mutex_unlock(&{l});")
                            active_locks.remove(l)

                lines.append("    usleep(10000); /* Small delay to simulate concurrency */")

            # Release remaining locks
            for l in list(active_locks):
                lines.append(f"    pthread_mutex_unlock(&{l});")

            lines.append("    return NULL;")
            lines.append("}")
            lines.append("")

        # Main Function
        lines.append("int main() {")
        lines.append("    printf(\"==========================================\\n\");")
        lines.append(f"    printf(\"  RaceGuard POSIX C Demo ({'FIXED' if is_fixed else 'BUGGY'})\\n\");")
        lines.append("    printf(\"==========================================\\n\");")
        lines.append("")

        thread_vars = []
        for idx, t_name in enumerate(threads_map.keys()):
            var_t = f"t_{sanitize_identifier(t_name)}"
            lines.append(f"    pthread_t {var_t};")
            thread_vars.append((t_name, var_t))

        lines.append("")
        lines.append("    /* Spawn OS Threads */")
        for t_name, var_t in thread_vars:
            func_name = f"{sanitize_identifier(t_name)}_runner"
            lines.append(f"    pthread_create(&{var_t}, NULL, {func_name}, NULL);")

        lines.append("")
        lines.append("    /* Wait for threads to complete */")
        for t_name, var_t in thread_vars:
            lines.append(f"    pthread_join({var_t}, NULL);")

        lines.append("")
        lines.append("    printf(\"\\n--- Final Memory Values ---\\n\");")
        for var in variables:
            s_var = sanitize_identifier(var)
            lines.append(f"    printf(\"Final {s_var}: %d\\n\", {s_var});")
        lines.append("    return 0;")
        lines.append("}")

        return "\n".join(lines)

    @staticmethod
    def generate_python_threading(events: List[Dict[str, Any]], variables: List[str], is_fixed: bool = False) -> str:
        lines = []
        lines.append("# RaceGuard Concurrency Demonstration - Python (threading)")
        lines.append(f"# Mode: {'MUTEX FIXED (Synchronized)' if is_fixed else 'BUGGY (Race Condition Present)'}")
        lines.append("# Run: python race_demo.py")
        lines.append("")
        lines.append("import threading")
        lines.append("import time")
        lines.append("")

        # Extract locks
        all_locks: Set[str] = set()
        for e in events:
            for l in e.get("locks_held", []):
                all_locks.add(sanitize_identifier(l))

        # Shared Variables
        lines.append("# Shared Global Variables")
        for var in variables:
            s_var = sanitize_identifier(var)
            init_val = 1000 if "balance" in s_var else 0
            lines.append(f"{s_var} = {init_val}")
        lines.append("")

        # Mutex Declaration
        lines.append("# Threading Locks")
        if not all_locks and is_fixed:
            all_locks.add("global_mutex")
        for lock in sorted(list(all_locks)):
            lines.append(f"{lock} = threading.Lock()")
        lines.append("")

        # Group events by thread
        threads_map: Dict[str, List[Dict[str, Any]]] = {}
        for e in events:
            t_name = e.get("thread_id", "Thread_1")
            threads_map.setdefault(t_name, []).append(e)

        # Thread Functions
        for t_name, t_events in threads_map.items():
            func_name = f"{sanitize_identifier(t_name)}_runner"
            lines.append(f"def {func_name}():")
            
            # Global declaration
            global_items = [sanitize_identifier(v) for v in variables] + sorted(list(all_locks))
            lines.append(f"    global {', '.join(global_items)}")
            
            sorted_events = sorted(t_events, key=lambda x: x.get("timestamp", 1))

            for ev in sorted_events:
                s_var = sanitize_identifier(ev.get("variable_name", "var"))
                op = ev.get("operation", "read").lower()
                locks = [sanitize_identifier(l) for l in ev.get("locks_held", [])]
                ts = ev.get("timestamp", 1)

                lines.append(f"    # Step t{ts}: {op.upper()} on {s_var}")

                if op == "read":
                    if locks:
                        for l in locks:
                            lines.append(f"    with {l}:")
                            lines.append(f"        val = {s_var}")
                            lines.append(f"        print(f\"[{t_name}] Read {s_var} = {{val}}\")")
                    else:
                        lines.append(f"    val = {s_var}")
                        lines.append(f"    print(f\"[{t_name}] Read {s_var} = {{val}}\")")
                elif op == "write":
                    delta = "100" if "balance" in s_var else "1"
                    if locks:
                        for l in locks:
                            lines.append(f"    with {l}:")
                            lines.append(f"        val = {s_var} + {delta}")
                            lines.append(f"        time.sleep(0.01)")
                            lines.append(f"        {s_var} = val")
                            lines.append(f"        print(f\"[{t_name}] Wrote {s_var} = {{{s_var}}}\")")
                    else:
                        lines.append(f"    val = {s_var} + {delta}")
                        lines.append(f"    time.sleep(0.01)")
                        lines.append(f"    {s_var} = val")
                        lines.append(f"    print(f\"[{t_name}] Wrote {s_var} = {{{s_var}}}\")")

                lines.append("    time.sleep(0.01)")
            lines.append("")

        # Main Script Body
        lines.append("if __name__ == '__main__':")
        lines.append("    print('==========================================')")
        lines.append(f"    print('  RaceGuard Python Demo ({'FIXED' if is_fixed else 'BUGGY'})')")
        lines.append("    print('==========================================')")
        lines.append("")

        thread_objs = []
        for t_name in threads_map.keys():
            func_name = f"{sanitize_identifier(t_name)}_runner"
            t_obj = f"t_{sanitize_identifier(t_name)}"
            lines.append(f"    {t_obj} = threading.Thread(target={func_name}, name='{t_name}')")
            thread_objs.append(t_obj)

        lines.append("")
        lines.append("    # Start Threads")
        for t_obj in thread_objs:
            lines.append(f"    {t_obj}.start()")

        lines.append("")
        lines.append("    # Join Threads")
        for t_obj in thread_objs:
            lines.append(f"    {t_obj}.join()")

        lines.append("")
        lines.append("    print('\\n--- Final Memory Values ---')")
        for var in variables:
            s_var = sanitize_identifier(var)
            lines.append(f"    print(f'Final {s_var}: {{{s_var}}}')")

        return "\n".join(lines)
