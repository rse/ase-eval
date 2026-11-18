#!/usr/bin/env bash
##
##  test-gateway-toolcall-cc.sh -- standalone test of the gateway tool-call
##  translation, driven through Claude Code in headless mode, so it reuses
##  the existing Claude Code login (SSO/OAuth) and needs no API key.
##
##  Each iteration forces one tool call (the Bash tool) and checks that it
##  was executed as a real "tool_use" block and that no native tool-call
##  markup leaked into the assistant text (DSML of DeepSeek v3.2,
##  <tool_call> of Qwen/GLM/Hermes, etc.).
##
##  Needs only bash, jq, and a logged-in "claude" CLI.
##
##  Usage: ./test-gateway-toolcall-cc.sh [<model>] [<iterations>]
##
##  Exits 0 if all sessions are clean, 1 otherwise. Each session burns a
##  small amount of real tokens (cents).
##

set -euo pipefail

model="${1:-deepseek.v3.2}"
iterations="${2:-3}"
timeout=180

#   native tool-call markers of the common model families
#   (fixed strings, matched against the joined assistant text)
markers=(
    "DSML"              # DeepSeek v3.2
    "<｜tool▁call"      # DeepSeek v3/R1 (fullwidth bar U+FF5C)
    "<tool_call>"       # Qwen, GLM, Hermes
    "<|python_tag|>"    # Llama 3
    "[TOOL_CALLS]"      # Mistral
    "<function_calls"   # Anthropic-style, leaked verbatim
)

prompt="Run the shell command \`echo gateway-tool-call-probe-ok\` with the Bash tool, then reply with exactly its output."

echo "model:      $model"
echo "iterations: $iterations (headless Claude Code sessions)"
echo

fails=0
for (( i = 1; i <= iterations; i++ )); do
    printf "[%2d] " "$i"

    #   one headless session; stream-json exposes every assistant message,
    #   so a leak in any intermediate turn is caught, not only the last one
    if ! out=$(timeout "$timeout" claude -p "$prompt" \
        --model "$model" --allowedTools "Bash(echo:*)" \
        --output-format stream-json --verbose 2>/dev/null); then
        echo "FAIL: session errored or hung (timeout ${timeout}s = possible mid-stream hang)"
        fails=$(( fails + 1 ))
        continue
    fi

    #   join all assistant text and count the executed tool_use blocks
    text=$(jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' <<<"$out")
    toolUses=$(jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name' <<<"$out" | grep -c . || true)

    leak=""
    for m in "${markers[@]}"; do
        if grep -qF -- "$m" <<<"$text"; then
            leak="$m"
            break
        fi
    done
    if [[ -n "$leak" ]]; then
        printf "tool_use=%-3s LEAK: %s\n" "$toolUses" "$leak"
        fails=$(( fails + 1 ))
    elif [[ "$toolUses" == "0" ]]; then
        printf "tool_use=0   FAIL: no tool call executed\n"
        fails=$(( fails + 1 ))
    else
        printf "tool_use=%-3s ok\n" "$toolUses"
    fi
done

echo
if [[ "$fails" -eq 0 ]]; then
    echo "PASS: $iterations/$iterations sessions executed the tool call cleanly"
    exit 0
else
    echo "FAIL: $fails of $iterations sessions leaked tool-call markup, dropped the call, or hung"
    exit 1
fi
