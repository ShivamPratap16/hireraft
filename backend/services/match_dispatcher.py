"""Match dispatcher — slice 1.

The auto-apply vs notify decision is extracted into `_decide` so it can be
unit-tested in isolation. The rest of the module is I/O plumbing.
"""

from __future__ import annotations

Decision = str  # "auto_apply" | "notify"


def _decide(
    score: float,
    auto_threshold: float,
    discovery_cap_remaining: int,
    per_platform_room: bool,
) -> Decision:
    """Decide auto_apply vs notify for a match.

    Caller must have already filtered score >= notify_threshold. This function
    only decides between auto_apply (when all gates pass) and notify (anything else).
    """
    can_auto = (
        score >= auto_threshold
        and discovery_cap_remaining > 0
        and per_platform_room
    )
    return "auto_apply" if can_auto else "notify"
