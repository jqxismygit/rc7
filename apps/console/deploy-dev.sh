#!/usr/bin/env bash

set -eu;

SERVER=${1:-cr7@cr7-dev}

DEPLOY_SCRIPT=$(realpath "`dirname $0`/../deploy.sh")
$DEPLOY_SCRIPT console $SERVER