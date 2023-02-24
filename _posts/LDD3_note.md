# 1.An Introduction to Device Drivers

the role of a device driver is providing mechanism, not poilcy.

Driver is a software layer lies between the applications and the actual device.	

memory mapping 内存映射

 Communication between the kernel and a network device driver is completely different from that used with char and block drivers. Instead of *read* and *write*, the kernel calls functions related to packet transmission.

