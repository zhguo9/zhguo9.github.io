#!/bin/sh
cd "./_posts/"
FILE=`zenity --file-selection --title="Select a File"`

case $? in
         0)
                echo "\"$FILE\" selected."
		typora "${FILE}" &;;
         1)
                echo "No file selected.";;
        -1)
                echo "An unexpected error has occurred.";;
esac
exit 0
