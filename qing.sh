#!/bin/bashi
current_date_time="`date "+%m-%d %H:%M:%S"`";
read -p "enter what you want to say:" SEN
echo "${current_date_time} 
${SEN}
">> ./_posts/qingyue.md
git add .
git commit -m "test"
git push
exit 0
