---
title: Compile Kernel
typora-root-url: ./
tags: kernel
---

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




> Happy Hacking !

