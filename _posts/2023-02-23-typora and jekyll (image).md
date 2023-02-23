---
title: typora and jekyll (image)
typora-root-url: ./
---

## 1. set the image root path(eg : zhguo9.github.io )

![image-20230223210703137](/../assets/images/2023-02-23-typora and jekyll (image)/image-20230223210703137.png)

## 2. set the insert path

```
../assets/images/${filename}
```

![image-20230223210823384](/../assets/images/2023-02-23-typora and jekyll (image)/image-20230223210823384.png)

## 3. touch a new file called new.sh for establishing new post

For me , it is like :

```shell
#!/bin/bash
# get date like 2023-02-23
date=$(date '+%Y-%m-%d')
# get title user want to enter
read -p "enter title:" title
# touch a new .md file
touch _posts/"$date-$title".md
# write some necessary content into the .md file
echo $"---
title: $title
typora-root-url: ./
---
" >> _posts/"$date-$title".md
# use typora to open the file for further edit
typora _posts/"$date-$title".md &
exit 0
```



Happy Hacking !
