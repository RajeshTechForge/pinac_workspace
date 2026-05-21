import { useCallback, useRef } from "react";
import { useChatContext } from "../context/ChatContext";
import type { Message } from "../types";

const MODELS = ["claude-sonnet-4-5", "claude-opus-4", "gpt-4o", "gemini-2.0"];

const MOCK_RESPONSES: Record<string, string[]> = {
  "claude-sonnet-4-5": [
    "That's a great question. Let me break it down systematically.\n\nFirst, the key insight here is that most performance bottlenecks come from I/O operations, not CPU. When you're dealing with large datasets, the cost of fetching data far outweighs the cost of processing it.\n\nHere's a practical approach:\n\n1. **Batch your requests** — never fetch one row at a time\n2. **Use connection pooling** — creating connections is expensive\n3. **Consider caching layers** — Redis or even in-memory caches work wonders\n\n```typescript\n// Instead of this:\nfor (const id of ids) {\n  const data = await db.fetch(id); // N round trips!\n}\n\n// Do this:\nconst results = await db.fetchMany(ids); // 1 round trip\n```\n\nThe difference can be 10-100x depending on your network latency.",
    "I see what you're getting at. This is actually a well-known pattern in distributed systems.\n\nThe approach I'd recommend depends on your consistency requirements:\n\n- **Strong consistency**: Use a distributed lock (etcd, ZooKeeper)\n- **Eventual consistency**: Use a leader election pattern\n- **Causal consistency**: Use vector clocks\n\nFor most applications, eventual consistency with conflict resolution is sufficient.",
    "Let me think about this carefully. There are a few different ways to approach this problem.\n\n**Option 1: State machine approach**\nThis works well when the number of states is finite and transitions are well-defined.\n\n**Option 2: Event sourcing**\nBetter for audit trails and complex reconstructions.\n\n**Option 3: Simple flags**\nGood enough for most CRUD apps.\n\nI'd lean toward option 1 for your use case.",
  ],
  "claude-opus-4": [
    "Excellent question. Let me provide a thorough analysis.\n\nWhen designing systems at scale, you need to consider the CAP theorem implications carefully. In practice, this means:\n\n1. **Partition tolerance is non-negotiable** — networks will fail\n2. **Choose between consistency and availability** based on your domain\n3. **Understand the tradeoffs deeply** before committing\n\n```python\n# A simple circuit breaker pattern\nclass CircuitBreaker:\n    def __init__(self, threshold=5, recovery_timeout=30):\n        self.failure_count = 0\n        self.threshold = threshold\n        self.recovery_timeout = recovery_timeout\n        self.last_failure_time = None\n        self.state = \"closed\"\n\n    def call(self, func, *args, **kwargs):\n        if self.state == \"open\":\n            if time.time() - self.last_failure_time > self.recovery_timeout:\n                self.state = \"half-open\"\n            else:\n                raise CircuitBreakerError()\n        try:\n            result = func(*args, **kwargs)\n            self.failure_count = 0\n            self.state = \"closed\"\n            return result\n        except Exception as e:\n            self.failure_count += 1\n            self.last_failure_time = time.time()\n            if self.failure_count >= self.threshold:\n                self.state = \"open\"\n            raise\n```\n\nThis pattern prevents cascading failures in distributed systems.",
    "This touches on an important architectural decision. Let me outline the tradeoffs.\n\n**Monolith first, modular later** is usually the right call. Premature microservices are the leading cause of architectural complexity in early-stage products.\n\nThat said, you should plan for modularity from day one:\n\n- Use bounded contexts in your domain model\n- Enforce strict module boundaries\n- Use events for cross-module communication\n- Keep shared kernel minimal\n\nWhen you eventually split, the boundaries will be clear.",
    "I've worked with this pattern extensively. Here's what I've learned.\n\nThe key to making this work is idempotency. Every operation must be safe to retry. This means:\n\n1. Each message has a unique ID\n2. Consumers track processed IDs\n3. Side effects are transactional\n\nWithout idempotency, at-least-once delivery guarantees become at-least-once disasters.",
  ],
  "gpt-4o": [
    "Good thinking. Here's what I'd suggest.\n\nStart by profiling your current setup to identify the actual bottlenecks. Don't optimize what you haven't measured.\n\n1. **First, measure** — use real metrics, not guesses\n2. **Then, identify** — find the top 3 slowest operations\n3. **Finally, optimize** — target those specifically\n\nMost teams skip step 1 and waste time on things that don't matter.",
    "That approach works, but there's a simpler way to think about it.\n\nThe essence of good software design is managing complexity. Every abstraction layer adds indirection but reduces cognitive load. The trick is finding the right balance.\n\nMy rule of thumb: if you can hold the entire module in your head at once, it's probably simple enough.",
    "Let me offer a different perspective on this.\n\nThe best code isn't the cleverest — it's the most obvious. Write code that reads like prose, where the intent is clear without comments.\n\n```javascript\n// Bad: clever but opaque\nconst r = a.reduce((x, y) => x.concat(y), []);\n\n// Good: obvious\nconst r = [].concat(...a);\n```\n\nOptimize for readability first, performance second.",
  ],
  "gemini-2.0": [
    "I can help with that. Let me analyze the problem from first principles.\n\nThe fundamental challenge here is that you're dealing with a complex adaptive system. Traditional approaches assume linear causality, but most real-world systems are non-linear.\n\nA better approach is to use **feedback loops**:\n\n1. Observe the current state\n2. Make a small change\n3. Measure the effect\n4. Adjust accordingly\n\nThis is essentially the scientific method applied to system design.",
    "Here's an approach that balances correctness with simplicity.\n\nThe 80/20 rule applies strongly here. 80% of the value comes from 20% of the features. Focus on getting that 20% right, and the rest will be easier to add later.\n\nPractical steps:\n\n1. Define the minimal viable behavior\n2. Build that first\n3. Add edge cases as they become necessary\n\nThis is how all successful systems are built.",
    "Let me think about this from the user's perspective first.\n\nUsers don't care about your architecture, your tech stack, or your code quality. They care about:\n\n1. Does it solve my problem?\n2. Is it fast enough?\n3. Is it reliable?\n\nEverything else is implementation detail. Start there and work backwards.",
  ],
};

function generateResponse(_conversationId: string, model: string): string {
  const responses = MOCK_RESPONSES[model] ?? MOCK_RESPONSES["claude-sonnet-4-5"];
  const idx = Math.floor(Math.random() * responses.length);
  return responses[idx];
}

export function useChat() {
  const { state, dispatch } = useChatContext();
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendMessage = useCallback(
    (content: string, model?: string, convIdOverride?: string) => {
      const convId = convIdOverride ?? state.activeConversationId;
      if (!convId) return;

      const selectedModel = model ?? state.settings.defaultModel;

      const userMsg: Message = {
        id: `msg-${Date.now()}-user`,
        conversationId: convId,
        role: "user",
        content,
        timestamp: Date.now(),
      };

      dispatch({ type: "ADD_MESSAGE", payload: userMsg });

      const assistantMsgId = `msg-${Date.now()}-assistant`;
      const assistantMsg: Message = {
        id: assistantMsgId,
        conversationId: convId,
        role: "assistant",
        content: "",
        model: selectedModel,
        timestamp: Date.now() + 1,
      };

      dispatch({ type: "ADD_MESSAGE", payload: assistantMsg });
      dispatch({
        type: "SET_STREAMING",
        payload: { messageId: assistantMsgId, text: "" },
      });

      const fullResponse = generateResponse(convId, selectedModel);
      const words = fullResponse.split(" ");
      let wordIndex = 0;

      const WORD_INTERVAL_MS = 40;

      streamTimerRef.current = setInterval(() => {
        if (wordIndex < words.length) {
          const word = (wordIndex === 0 ? "" : " ") + words[wordIndex];
          dispatch({ type: "APPEND_STREAM_TEXT", payload: word });
          wordIndex++;
        } else {
          if (streamTimerRef.current) clearInterval(streamTimerRef.current);
          dispatch({ type: "FINISH_STREAMING", payload: undefined });
        }
      }, WORD_INTERVAL_MS);
    },
    [state.activeConversationId, state.settings.defaultModel, dispatch],
  );

  const cancelStreaming = useCallback(() => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    const messageId = state.streamingMessageId;
    if (messageId) {
      dispatch({ type: "FINISH_STREAMING", payload: undefined });
    }
  }, [state.streamingMessageId, dispatch]);

  return {
    sendMessage,
    cancelStreaming,
    isStreaming: state.isStreaming,
    streamingText: state.streamingText,
    activeModel: state.settings.defaultModel,
    models: MODELS,
  };
}
