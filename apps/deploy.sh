#!/usr/bin/env bash

set -eu;

BASE_DIR=$(dirname `realpath $0`)
APP=$1
SERVER=$2

echo 'build app...';
pnpm --filter "$APP" -s build

echo 'package app...';
APP_DIR="$BASE_DIR/$APP"
PACKAGE="$APP.tgz"
tar --no-xattrs -C "$APP_DIR/dist/" -zcf "$APP_DIR/$PACKAGE" ./

echo "deploy APP=$APP to $SERVER...";\
# 检测操作系统，Windows 下使用 scp，Linux 下使用 rsync
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
    echo "Detected Windows environment, using scp..."
    scp "$APP_DIR/$PACKAGE" $SERVER:
else
    echo "Detected Linux/Unix environment, using rsync..."
    rsync -acvP "$APP_DIR/$PACKAGE" $SERVER:
fi
ssh $SERVER "./etc/deploy-web.sh $APP $PACKAGE"
