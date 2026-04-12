#!/usr/bin/env bash

set -eu;

SCRIPT_DIR=`dirname $(realpath $0)`;
SERVER=${1:-cr7@cr7-prod};

echo "deploy to $SERVER ...";
"${SCRIPT_DIR}/deploy.sh" $SERVER;

ssh $SERVER "systemctl --user daemon-reload && systemctl --user restart wechat"