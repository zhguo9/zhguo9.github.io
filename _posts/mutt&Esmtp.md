# mutt & esmtp

`sudo apt install mutt;sudo apt install esmtp`

```
zhguo@Dell:~$ cat .esmtprc 
identity zhguo9@gmail.com
hostname smtp.gmail.com:587
username zhguo9@gmail.com
password gciildmogbujrwih
starttls required 


zhguo@Dell:~$ cat .muttrc 
set sendmail="/usr/bin/esmtp"
set envelope_from=yes
set from="zhguo <zhguo9@gmail.com>"
set use_from=yes
set edit_headers=yes
```



# unzip tar.bz2

```
tar -xvjf enginsxt.tar.bz2
```



# git log

view the commit history by running

```shell
git log
#  see just the "short description" for each commit
git log --oneline
```



# git checkout

```
In Git terms, a "checkout" is the act of switching between different versions of a target entity. The git checkout command operates upon three distinct entities: files, commits, and branches.
```



```shell
 # use git to fetch the latest changes:
 git fetch origin
```



# crontab command

```
1: Minute (0-59)
2: Hours (0-23)
3: Day (0-31)
4: Month (0-12 [12 == December])
5: Day of the week(0-7 [7 or 0 == sunday])
```

