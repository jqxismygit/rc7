#!/usr/bin/env bash

set -eu;

BASE_DIR=$(dirname `realpath $0`)
cd $BASE_DIR/../..;

SERVER=$1

shift

echo "build wechat...";
pnpm -w --filter @cr7/wechat build

echo "deploy to $SERVER";
rsync -aP etc                                                           "$SERVER:";
rsync -aP etc/wechat.service                                            "$SERVER:.config/systemd/user/";

echo "deploy wechat...";
rsync -aP --delete --delete-excluded --include="**/*.js" --exclude="*.*" \
    "services/wechat/dist/"                                            "$SERVER:services/wechat/"

echo "deploy default settings template...";
rsync -aP "services/wechat/wechat-settings.json.example"               "$SERVER:services/wechat/";