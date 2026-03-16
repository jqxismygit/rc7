#!/usr/bin/env bash

set -eu;

SCRIPT_DIR=`dirname $(realpath $0)`;
SERVER=${1:-cr7@cr7-dev};

echo "deploy to $SERVER ...";
"${SCRIPT_DIR}/deploy.sh" $SERVER;

ssh $SERVER "pnpm -w s cr7 bootstrap -c production \
&& pnpm -w s cr7 migration upgrade -c production \
&& systemctl --user restart cr7"