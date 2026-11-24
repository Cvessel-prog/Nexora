"""Provider adapters: real calls, key isolation and failure containment."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from core import provider_adapters, provider_auth


class FakeHTTP:
    def __init__(self, response: dict | None = None, fail: bool = False) -> None:
        self.response = response or {}
        self.fail = fail
        self.calls: list[tuple] = []

    def __call__(self, url: str, payload: dict, headers: dict, timeout: float) -> dict:
        self.calls.append((url, dict(payload), dict(headers), timeout))
        if self.fail:
            raise OSError("connection refused")
        return self.response


def main() -> None:
    original_root = provider_auth.app_data_root
    original_post = provider_adapters._post_json
    with tempfile.TemporaryDirectory() as tmp:
        provider_auth.app_data_root = lambda: Path(tmp)  # noqa: E731 - test isolation
        try:
            # 未配置连接器时，调用被安全拒绝。
            provider_auth.authorize_provider("local-openai", ["reflection:summary"])
            preview = provider_auth.prepare_call("local-openai", "reflection:summary", {"dimension": "mind", "summary": "节奏", "secret": "drop"})
            assert provider_auth.decide_call(preview["requestId"], "approve")["decision"] == "approved"
            result = provider_adapters.call("local-openai", preview["requestId"])
            assert result["ok"] is False and "未配置" in result["error"], result

            # 配置后调用成功；Key 只出现在请求头里，不进入返回值或配置视图。
            provider_adapters.configure("local-openai", base_url="http://127.0.0.1:8080/v1", model="test-model", api_key="sk-test", timeout=5)
            view = provider_adapters.config_view("local-openai")
            assert view["hasApiKey"] is True and "sk-test" not in str(view), view

            fake = FakeHTTP({"choices": [{"message": {"content": "好的。"}}], "model": "test-model", "usage": {"total_tokens": 12}})
            provider_adapters._post_json = fake
            result = provider_adapters.call("local-openai", preview["requestId"])
            assert result["ok"] is True and result["text"] == "好的。", result
            assert fake.calls[-1][2]["Authorization"] == "Bearer sk-test", fake.calls[-1]
            assert "sk-test" not in str(result), result

            # 批准必须绑定到同一个 Provider，不能批准 A 后发送给 B。
            provider_auth.authorize_provider("custom", ["reflection:summary"])
            mismatch = provider_auth.prepare_call("local-openai", "reflection:summary", {"summary": "target-bound"})
            provider_auth.decide_call(mismatch["requestId"], "approve")
            provider_adapters.configure("custom", base_url="http://127.0.0.1:8081/v1", model="other-model")
            calls_before = len(fake.calls)
            rejected = provider_adapters.call("custom", mismatch["requestId"])
            assert rejected["ok"] is False and "Provider 不一致" in rejected["error"], rejected
            assert len(fake.calls) == calls_before, "目标不匹配时不应发送网络请求"

            # 远端成功后若成功审计失败，必须明确暴露“已发送但无审计”，不能伪装成普通失败。
            audit_failure = provider_auth.prepare_call("local-openai", "reflection:summary", {"summary": "audit-bound"})
            provider_auth.decide_call(audit_failure["requestId"], "approve")
            original_audit = provider_auth.audit_call
            provider_auth.audit_call = lambda *args, **kwargs: (_ for _ in ()).throw(OSError("audit disk full"))
            try:
                unaudited = provider_adapters.call("local-openai", audit_failure["requestId"])
            finally:
                provider_auth.audit_call = original_audit
            assert unaudited["ok"] is False and unaudited["providerCallSucceeded"] is True, unaudited
            assert unaudited["auditRecorded"] is False and "audit disk full" in unaudited["error"], unaudited

            # 同一次批准不能重复使用。
            try:
                provider_auth.approved_payload(preview["requestId"])
                raise AssertionError("重复调用被接受")
            except provider_auth.ProviderAuthError as exc:
                assert "未批准" in str(exc) or "过期" in str(exc), exc

            # 外部失败被隔离，且审计链保持完整。
            provider_auth.authorize_provider("ollama", ["reflection:summary"])
            second = provider_auth.prepare_call("ollama", "reflection:summary", {"summary": "x"})
            provider_auth.decide_call(second["requestId"], "approve")
            provider_adapters.configure("ollama", base_url="http://127.0.0.1:11434", model="llama3")
            provider_adapters._post_json = FakeHTTP(fail=True)
            failed = provider_adapters.call("ollama", second["requestId"])
            assert failed["ok"] is False and "connection refused" in failed["error"], failed
            assert provider_auth.audit_log()["integrity"]["status"] == "verified", provider_auth.audit_log()

            # 未知 Provider / 非法 base_url 被拒绝。
            for kwargs in ({"base_url": "not-a-url", "model": "m"},):
                try:
                    provider_adapters.configure("custom", **kwargs)
                    raise AssertionError("非法配置被接受")
                except provider_adapters.AdapterError:
                    pass
        finally:
            provider_adapters._post_json = original_post
            provider_auth.app_data_root = original_root

    print("provider adapter call, key isolation and failure tests passed")


if __name__ == "__main__":
    main()
