import sys
import asyncio
import json
sys.path.append("apps/engine")
from app.engine.live_runner import tick_bot, get_latest_bot_evaluation

async def test_live_tick():
    bot_id = "4c700c8b-e6c3-43aa-bba2-ea2fa924fcb5"
    await tick_bot(bot_id)
    eval_data = get_latest_bot_evaluation(bot_id)
    if eval_data:
        steps = eval_data.get("steps", [])
        print("Total steps:", len(steps))
        for s in steps:
            print(f"- Node: {s.get('nodeId')} | Type: {s.get('nodeType')} | Layer: {s.get('layer')}")
            output = s.get("output", {})
            audit = output.get("audit", {}) if isinstance(output, dict) else {}
            if audit:
                print(f"    llm_status: {audit.get('llm_status')} | model: {audit.get('model_config', {}).get('modelId')}")
                if audit.get("llm_error"):
                    print(f"    llm_error: {audit.get('llm_error')}")
            if isinstance(output, dict) and "rationale" in output:
                print(f"    rationale: {output.get('rationale')}")

if __name__ == "__main__":
    asyncio.run(test_live_tick())
