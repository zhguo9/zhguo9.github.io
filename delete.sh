#!/bin/bash
FILE=`zenity --file-selection --title="Select a File"`

case $? in
         0)
		read -p "\"${FILE}\" is going to be deleted, Are you sure ?(y/n) " SURE;
		if [ "${SURE}" = "y" ];then
			rm "${FILE}"
			echo "${FILE} deleted"
		elif [ "${SURE}" = "n" ];then
			echo "delete cancled"
		else
			echo "wrong character"
		fi;;
         1)
                echo "No file selected.";;
        -1)
                echo "An unexpected error has occurred.";;
esac
exit 0
