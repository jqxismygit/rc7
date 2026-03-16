#!/usr/bin/env bash

set -eu;

BASE_DIR=$(dirname `realpath $0`)
cd $BASE_DIR/../..;

SERVER=$1

shift

echo "build dependencies...";
pnpm -w s build


echo "deploy to $SERVER;
rsync -aP  etc                                                           "$SERVER:";
rsync -aP ./{pnpm-workspace.yaml,pnpm-lock.yaml,package.json}            "$SERVER:";

echo "install dependence...";
rsync -aPR  "services/cr7/package.json"                                  "$SERVER:";
ssh $SERVER "pnpm install --prefer-offline --frozen-lockfile --prod";

echo "deploy cr7...";
rsync -aPR "services/cr7/dist/src/api.service.js"                        "$SERVER:"
rsync -aP --delete --delete-excluded --include="**/*.js" --exclude="*.*" \
    "services/cr7/dist/src/"               "$SERVER:services/cr7/dist/src/"

echo "deploy server service file...";
rsync -aPR  services/cr7/config/default.mjs                               "$SERVER:";
rsync -aPR  services/cr7/db                                               "$SERVER:" --delete;
