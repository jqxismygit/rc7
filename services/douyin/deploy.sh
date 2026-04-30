#!/usr/bin/env bash

set -eu;

BASE_DIR=$(dirname `realpath $0`)
cd $BASE_DIR/../..;

SERVER=$1

shift

echo "build douyin...";
pnpm -w --filter @cr7/douyin build

echo "deploy to $SERVER";
rsync -aP etc/douyin.service                                            "$SERVER:.config/systemd/user/";

echo "deploy douyin project settings...";
rsync -aP "services/douyin/package.json"                                "$SERVER:services/douyin/";

echo "deploy douyin...";
rsync -aP "services/douyin/dist/"                                       "$SERVER:services/douyin/"

echo "deploy default settings template...";
rsync -aP "services/douyin/douyin-settings.json.example"               "$SERVER:services/douyin/";
