#!/bin/bash
git add .
read -p "input comment:" com
git commit -m "$com"
git push
