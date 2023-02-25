---
title: Log problems(Remote Server)
typora-root-url: ./
tags: server
---

[toc]

# How to login into a machine shortly

```shell
vim ~/.ssh/config
```

appen following :

```
Host remote-name
    HostName meh.example.com
    User admin
    Port 1234
    IdentityFile ~/.ssh/id_rsa
```

Then you can use

```shell
ssh remote-name
```

to log in!



# Perform SSH Login Without Password

```shell
ssh-copy-id -i ~/.ssh/id_rsa.pub root@192.168.1.1
```



> Happy Hacking !
