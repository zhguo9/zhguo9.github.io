#!/bin/bash
date=$(date '+%Y-%m-%d')
read -p "enter title:" title
touch _posts/"$date-$title".md
echo "---
title: $title
typora-root-url: ./
---






> Happy Hacking !
" >> _posts/"$date-$title".md
typora _posts/"$date-$title".md &
exit 0
