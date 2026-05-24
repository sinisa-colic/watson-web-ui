#!/bin/sh
# Non-interactive editor for `watson edit`: writes WATSON_EDIT_JSON to the temp file.
printf '%s' "$WATSON_EDIT_JSON" > "$1"
