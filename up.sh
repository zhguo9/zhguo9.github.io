#!/bin/bash
#for FILE in ./_post/*
#do
#	DATE=stat $FILE | grep Modify | grep -o "20..-..-.."
#	FILENEW="${DATE}+${FILE:10:}"
#	mv $FILE $FILENEW
git add .
read -p "input comment:" com
git commit -m "$com"
git push
