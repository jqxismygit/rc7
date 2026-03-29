#!/usr/bin/env sh

set -e;

APP=$1
PKG=$(realpath "$2")
dst="$APP-$(date +%Y%m%dT%H%M%S)";

echo $PKG;
echo "deploying to $dst ..";
cd "/var/lib/cr7";

mkdir -p $dst;
cd $dst;
tar xf $PKG --strip-components=1 --exclude "*.map";

cd ..;
echo "linking release to `realpath $dst`";
ln -sfn `realpath $dst` $APP;