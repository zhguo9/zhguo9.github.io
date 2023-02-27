---
title: Bridging_and_Forwarding
typora-root-url: ./
tags: subsystem
---

# Bridging Details

------

## Initialization



1. The initialization and clean up routines are **br_init()** and **br_uninit()** respectively.

2. Initialization consists of

   

   1. allocating memory for ***net_bridge_fdb_entry*** structures
   2. Initialization of function pointer **br_ioctl_hook** to the routine
   3. Initialization of Function pointer **br_handle_frame_hook** to the routine to process ingress BPDU.



## Creating a Bridge



1. Each Bridge Device can have up to a maximum of 1024 ports.
2. Bridge devices are created and removed using **br_add_bridge()** and **br_del_bridge()**
3. Ports are added to a bridge device with **br_add_if()** and removed with **br_del_if()**
4. The above routines execute with NETLINK routing lock held.The routines **rtnl_lock()** and **rtnl_unlock()** help in acquiring and releasing the locks.
5. **br_add_bridge()** and **br_del_bridge()** take care of locking on their own.
6. **br_add_if()** and **br_del_if()** uses **dev_ioctl()** to take care of locking/unlocking.



## Bridge Device Creation



1. The **new_bridge_dev(const char\* name_of_the_bridge)** function takes care of creating a new bridge.
   1. It initializes the net_device data structure
   2. Initializes the private data structure i.e (network device's private data ***netdev->priv***)
   3. Initializes the per-bridge timers with **br_stp_timer_init(struct net_bridge \*br)**



## Bridge Device Setup



1. The Bridges use the **br_dev_setup(struct net_device\* netdev)** routine to set up the bridge.The **br_dev_setup()**
   - routine is invoked in **new_bridge_dev()** function by calling allocate_dev() to which **br_dev_setup()** is given as function pointer.
2. The kernel distinguishes the bridge from other devices if the **IFF_EBRIDGE**flag is set in ***struct net_device***.
3. The function **br_dev_ioctl(struct net_device \*dev, struct ifreq \*rq, int cmd)** processes some of the ioctl commands
   - thats issued in the bridge devices.
4. The bridging device driver initializes the **br_dev_xmit(struct sk_buff \*skb,struct net_device \*dev)** which
   - is invoked in **br_dev_setup()** routine by initializing ***br_dev_xmit*** to ***hard_start_xmit*** function pointer available in ***net_device*** data structure.



## Deleting a Bridge



1. To remove a bridge,**br_del_bridge()** routine invokes **del_br()** which does as

   - follows

     

     1. Removes all the bridge ports
     2. For each port,removes all the corresponding entries in the forwarding database.
     3. Removes the bridge device directory in /sys/class/net directory.
     4. De registers the device using the routine unregister_netdevice



## Forwarding Database



1. Each Bridge instance has its own forwarding database used regardless whether

   

   - STP is run or not.

2. The Forwarding database is placed in the net_bridge data structure and defined as hash table.

3. An instance of the net_bridge_fdb_entry data structure is added to the database for each MAC address learnt on the bridge ports.



## Lookups



1. **struct net_bridge_fdb_entry \*fdb_find(struct hlist_head \*head,const unsigned char \*addr)**
   1. Is used for querying net_bridge_fdb_entry for a given MAC address.
   2. Not used for forwarding data traffic.
2. **struct net_bridge_fdb_entry \*br_fdb_get(struct net_bridge \*br,const unsigned char \*addr)**

1. Similar to **fdb_find** but used to forward traffic, called by bridging code (**br_dev_xmit()** routine)
2. Adding/Updating/Removing Entries

1. The ***net_bridge_fdb_entry*** data structure is populated with the device MAC
   - address using the **br_fdb_insert(struct net_bridge \*br, struct net_bridge_port \*source, const unsigned char \*addr)** which is called by the **br_add_if(struct net_bridge \*br, struct net_device \*dev)** routine which is called by **add_del_if()** routine called by **br_dev_ioctl()** routine which processes the ioctl commands by the user.



## Removing



- . The net_bridge_fdb_entry entries are removed using

  

  - **void fdb_delete(struct net_bridge_fdb_entry \*f)** routine.



## Handling Ingress Traffic



1. Reciept of frame is handled by **netif_receive_skb()** which calls
   - **handle_bridge()**. **handle_bridge()** is defined as NULL Pointer if the kernel does not have support for bridging.
2. If the kernel has support for bridging,**handle_bridge()** processes the
   - frame with br_handle_frame_hook.
3. The ***br_handle_frame_hook*** is initialized with ***br_handle_frame*** in the routine during the
   - bridge module initialization.When the packet is received,the **netif_receive_skb()** calls **handle_bridge()** which calls the br_handle_frame_hook.



## Transmitting on a Bridge Device



1. The ***hard_start_xmit*** in net_device is initialized with
   - **br_dev_xmit(struct sk_buff \*skb, struct net_device \*dev)** routine which has the logic used by the bride to transmit data.



## Overall Process



1. When a NIC is configured as a bridge port, the ***br_port*** member of the

   - ***net_device*** is initialized.

2. Receipt of frame is handled by **netif_receive_skb()** which calls

   - handle_bridge()

3. To transmit the frame, **dev_queue_xmit()** function is called which invokes the

   - **hard_start_xmit()** routine provided by the device driver.

4. The bridging forwarding database is searched for destination MAC address.

5. In case of a success, the frame is sent to the bridge port by making a call

   

   - to **br_forward()**

6. If the MAC lookup is a failure, the frame is flooded using **br_flood()**

Following are the Data Structures

1. ***net_bridge_fdb_entry*** - Entry of the Forwarding Database.There is one for each MAC address learned by the bridge.
2. ***net_bridge*** - Information about the bridge.



# Routing/Forwarding Subsystem





------



1. Routing table is implemented using the ***struct fib_table*** data structure.

2. There are two routing tables by default

   

   - Local FIB Table
   - Main FIB Table

3. Reading entries in the routing table is done by calling the **fib_lookup()** function.

4. Routing tables are consulted using the **ip_route_input_slow()** and **ip_route_output_slow()** functions.

5. Two versions of **fib_lookup()** exist,one used when the kernel has support for policy routing and the other when the support is not included.

   - The selection is made at compile time.

6. All routing table lookups regardless the direction of the traffic, is done using the **fn_hash_lookup()** function.This function's lookup

   - algorithm uses the LPM algorithm.

   1.The routing cache is built using ***rtable*** elements.



## Routing Lookup



1. The **ip_route_input()** is called and makes a cache lookup. If the cache lookup

   - results in a HIT then the packet is delievered using **ip_local_deliver()** or **ip_forward()**

2. If the cache lookup results in a MISS then call to **fib_lookup()** is made and

   - it in turn queries the LOCAL FIB Table.If the route exists the packet is

     

     delivered using the **ip_local_deliver()** or **ip_forward()** function.

3. If the route does not exist in the LOCAL FIB, the MAIN FIB is looked up and

   

   - if the route exists in the main table the packet is forwarded as above else the packet is dropped.



## Packet Forwarding



Forwarding is split into two functions

- **ip_forward()**
- **ip_forward_finish()**

1. **int ip_forward(struct sk_buff\* skbuff)**
   - Forwards the packet
   - Decreases the TTL in the IP header
   - if TTL is <=1, send ICMP message and packet is dropped.
   - Calls **NF_HOOK(NF_HOOK(PF_INET,NF_IP_FORWARD, skb, skb->dev, rt->u.dst.dev, ip_forward_finish)**
2. **ip_forward_finish()**
   - Sends the packet out by calling **dst_output(skb)**
3. **dst_output(skb)**
   - is a wrapper which in turn calls ***skb->dst->output(skb)***


> Happy Hacking !

