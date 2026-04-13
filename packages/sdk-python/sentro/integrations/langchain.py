"""Sentro integration for LangChain agents.

Usage:
    from sentro import Sentro
    from sentro.integrations.langchain import SentroMiddleware

    sentro = Sentro(dsn="http://token@localhost:3000/api/ingest/proj_1")
    middleware = SentroMiddleware(sentro)

    agent = create_agent(
        model="gpt-4o",
        tools=[...],
        middleware=[middleware],
    )
"""
from __future__ import annotations
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from sentro import Sentro

try:
    from langchain.agents.middleware import AgentMiddleware
    from langchain.tools.tool_node import ToolCallRequest
    from langchain.messages import ToolMessage
    from langgraph.types import Command
except ImportError:
    raise ImportError(
        "LangChain is required for this integration. "
        "Install it with: pip install langchain langgraph"
    )


class SentroMiddleware(AgentMiddleware):
    """LangChain middleware that sends tool call traces to Sentro."""

    def __init__(self, client: "Sentro", agent_name: str = "langchain-agent"):
        self._client = client
        self._agent_name = agent_name

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        tool_name = request.tool_call.get("name", "unknown")
        tool_args = request.tool_call.get("args", {})

        # Use the SDK's trace API
        with self._client.trace(self._agent_name, goal="langchain-tool-call") as run:
            with run.trace(f"tool: {tool_name}") as step:
                with step.trace_tool_call(tool_name, input=tool_args) as tc:
                    try:
                        result = handler(request)
                        if isinstance(result, ToolMessage):
                            tc.set_result({"content": result.content})
                        return result
                    except Exception as e:
                        tc.set_result({"error": str(e)})
                        raise
