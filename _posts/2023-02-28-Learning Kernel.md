---
title: Learning Kernel
typora-root-url: ./
tags: kernel
---

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



## Change your config

`make localmodconfig` :  generate the .config with a kernel module that is in using now

## Build the kernel

`make -j 10` : use 10 cores of your CPU to compile.

## Install the kernel

In Ubuntu,use:

```shell
sudo make modules_install install
```

`make modules_install` : install kernel modules to `/lib/modules/`

`make install` : Install the kernel binary image, generate and install the BOOT initialization file system image file

## Uninstall the kernel

1. remove unused kernel lib file under `/lib/modules` 
2. remove kernel image under `/boot` (initrd.img config  vmlinuz System.map)
3. `sudo update-grub2`



## git rebase & git merge

```
git merge 会让提交混乱；git rebase会在master现有基础上再增加feature分支的提交，条理清晰
```

当你在 Git 中进行开发时，可能会遇到需要合并代码的情况。合并代码时，Git 通常会使用 `git merge` 命令，它会将两个或多个分支合并成一个新的提交。但是，使用 `git merge` 会创建一些“奇怪”的提交记录，因为它会在分支上添加一个额外的合并提交。

为了避免这种情况，Git 提供了 `git rebase` 命令，它可以在将两个分支合并之前，将一个分支的提交应用到另一个分支上。这样做的结果是，你的提交记录仍然保持线性，而不会出现奇怪的合并提交。

下面是一个例子来说明这个过程。假设你有两个分支，一个是 `feature` 分支，一个是 `master` 分支。你希望将 `feature` 分支的提交应用到 `master` 分支上。通常情况下，你会使用 `git merge` 命令，它会将两个分支合并成一个新的提交：

![img](/../public/images/2023-02-28-Learning%20Kernel/7000-1678239519002-3.jpeg)

```
rubyCopy code$ git checkout master
$ git merge feature
```

这样做会创建一个新的合并提交，其中包含来自 `feature` 和 `master` 分支的提交。这会使你的提交记录看起来很混乱。

相反，你可以使用 `git rebase` 命令，它会将 `feature` 分支的提交重新应用到 `master` 分支上。这样做会创建一个新的提交历史，其中包含来自 `feature` 和 `master` 分支的提交，但不会创建一个新的合并提交。

![img](/../public/images/2023-02-28-Learning%20Kernel/7000.jpeg)

```
rubyCopy code$ git checkout feature
$ git rebase master
```

这个命令会将 `feature` 分支的提交应用到 `master` 分支上，而不会创建新的合并提交。最终的结果是一个线性的提交历史，其中包含来自两个分支的提交。


> Happy Hacking !

