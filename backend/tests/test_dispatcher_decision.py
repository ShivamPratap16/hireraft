from backend.services.match_dispatcher import _decide


def test_above_auto_threshold_with_room_returns_auto_apply():
    decision = _decide(
        score=0.95,
        auto_threshold=0.9,
        discovery_cap_remaining=10,
        per_platform_room=True,
    )
    assert decision == "auto_apply"


def test_above_auto_but_cap_exhausted_returns_notify():
    decision = _decide(
        score=0.95,
        auto_threshold=0.9,
        discovery_cap_remaining=0,
        per_platform_room=True,
    )
    assert decision == "notify"


def test_above_auto_but_platform_limit_hit_returns_notify():
    decision = _decide(
        score=0.95,
        auto_threshold=0.9,
        discovery_cap_remaining=10,
        per_platform_room=False,
    )
    assert decision == "notify"


def test_between_thresholds_returns_notify():
    decision = _decide(
        score=0.75,
        auto_threshold=0.9,
        discovery_cap_remaining=10,
        per_platform_room=True,
    )
    assert decision == "notify"


def test_exactly_at_auto_threshold_qualifies_as_auto_apply():
    decision = _decide(
        score=0.9,
        auto_threshold=0.9,
        discovery_cap_remaining=1,
        per_platform_room=True,
    )
    assert decision == "auto_apply"
