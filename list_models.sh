#!/usr/bin/env bash
##
##  list_models.sh -- list the available models of the agent tool, fetched
##  (like launch_tests.sh) via the "initialize" control request of the
##  stream-json interface of "claude", one model per line:
##  <value> <TAB> <resolved model id> <TAB> <display name>
##
##  Usage: ./list_models.sh [--ids]
##    --ids   print only the resolved model ids (usable for --models)
##

set -euo pipefail

#   check the required tools
for tool in claude jq timeout; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "list_models.sh: ERROR: required tool \"$tool\" not found" 1>&2
        exit 1
    fi
done

#   send the "initialize" control request and capture the stream-json output
request='{"type":"control_request","request_id":"1","request":{"subtype":"initialize"}}'
output=$(echo "$request" | timeout 120 claude -p \
    --input-format stream-json --output-format stream-json --verbose 2>/dev/null || true)

#   extract the model listing from the control response
#   (the listing "value" can be a UI alias, so also show the resolved model id)
models=$(echo "$output" | jq -r -R '
    fromjson? | select(.type == "control_response") |
    .response.response.models[]? |
    [ .value,
      (if (.resolvedModel // "") != "" then .resolvedModel else .value end),
      (.displayName // "") ] | @tsv')
if [[ -z "$models" ]]; then
    echo "list_models.sh: ERROR: model listing failed: no control_response from \"claude\"" 1>&2
    exit 1
fi

#   print the listing
if [[ "${1:-}" == "--ids" ]]; then
    echo "$models" | cut -f2 | awk '!seen[$0]++'
else
    echo "$models" | column -t -s $'\t'
fi
