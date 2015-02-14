#!/bin/bash

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

OUTDIR='../www/assets/images/'
VECTOR=$OUTDIR'courierchat.svg'

# Requires librsvg2-bin
rsvg -d 96 -w 16 -h 16 -f png $VECTOR $OUTDIR/favicon.png
rsvg -d 96 -w 144 -h 144 -f png $VECTOR $OUTDIR/favicon-144.png
rsvg -d 96 -w 152 -h 152 -f png $VECTOR $OUTDIR/favicon-152.png
