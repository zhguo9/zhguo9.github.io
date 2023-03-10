---
title: Hacking-the-wholism-of-GNULinux-net*
typora-root-url: ./
tags: subsystem
---

root@slackware-13.1:/home/forsaken# uname -a
Linux common-slackware 2.6.33.4-smp #2 SMP Wed May 12 22:47:36 2044
i686 Intel(R) Core(TM)2 Duo CPU     E7500  @ 2.93GHz GenuineIntel
GNU/Linux


|=-----------------------------------------------------------------=|
|=------------=[Hacking the wholism of GNU/Linux net*]=------------=|
|=----------------=[ Netfilter <====> NIC driver ]=----------------=|
|=-----------------------------------------------------------------=|
|=-----------------------------------------------------------------=|
|=-------------------=[ By Shawn the R0ck   ]=---------------------=|
|=-------------------=[ <citypw@gmail.com>  ]=---------------------=|
|=-----------------------------------------------------------------=|
|=------------------------=[ July 7 2011  ]=-----------------------=|
|=-----------------------------------------------------------------=|


--[ Contents

0. Introduction

1. What is iptables/Netfilter framework

   1.1 Hook your packet

   ​    1.1.1 Iptables sample

   1.2 Write your own hook function

   1.3 What can Netfilter do

   ​    1.3.1 Other important components in Netfilter

2. Linux networking systems: A monkey-coder's perspective

   2.1 Initialization of the NIC driver

   2.2 RX packets

   2.3 TX packets

   2.4 Three ways of packet's traveling

   ​    2.4.1 Network to Host

   ​    2.4.2 Network to Network

   ​    2.4.3 Host to Network
   ​    
   2.5 A bigger picture

3. Conclusion

   3.1 Gratitude

4.  References



--[ 0. Introduction

This article will discuss 2 topics of GNU/Linux networking system at
the introduction-level. In the 1st part I will give you a simple way
to introduce Netfiler and iptables. I'm not going further into
userspace tools and just give some cmd-lines of iptables as examples
that you can understand the relationship between iptables and
netfilter. I will also provide some source codes which the original
ones come from one of the great papers in phrack magazine[1]. You can
see bunch of encoded stuff at bottom of this article, but you must try
to use the tools "uudecode"(Phrack guys would not tell you this
because they treated you as hackers || I'm not implying that I treat
you as "users" -_-) to get source code of the netfilter samples which
tested in GNU/Linux kernel 2.6.33[2].

In the 2nd part of this article I will talk about how a packet travels
around in GNU/Linux kernel from NIC driver layer to network stack and
use the REALTEK 8169 NIC driver source code as example, which can be
found in /usr/src/linux-2.6.33.4/drivers/net/r8169.c.

I will follow the principle "read the fucking source code" in
discussion.

I have been using GNU/Linux for 4 years. And I started hacking on
network system( both of user space and kernel space) of GNU/Linux one
year ago. So I'm trying to make the pieces of my notes into one
article you are reading now. Share the information, be free and
opening. "By the community, for the community." should be a hacker's
creed.


--[ 1. What is iptables/netfilter framework

Netfilter is a framework that provides hook mechanism for those who
need to write their own functions for mangling packets within
GNU/Linux kernel.  Iptables is the userspace command-line program to
configure the filtering rules of the GNU/linux kernel. Both of them
are free softwares.


----[ 1.1 Hook your packet

Netfilter can filter the packet of the kernel network stack by
inserting your own kernel modules. Netfilter has 4
tables(filter,nat,mangle,raw) and 5 chains. The hooks is the
implementation of chains in protocol stack.  The different protocol
families(IPv4, IPv6, etc) of hooks linked each other by linked
list. Every table may have multiple policies stored in an array.

The declaration of the symbols can be found in
/usr/src/linux-2.6.33.4/include/linux. These hooks are displayed in
the table below:

Table 1: Available IPv4 hooks

   Hook                 Called
NF_IP_PRE_ROUTING   After sanity checks, before routing decisions. 
		    invoked in ip_rcv().

NF_IP_LOCAL_IN      After routing decisions if packet is for this host.
		    invoked in ip_local_deliver().

NF_IP_FORWARD       If the packet is destined for another interface.
		    invoked in ip_forward().

NF_IP_LOCAL_OUT     For packets coming from local processes on their way out.
		    invoked in __ip_local_out().

NF_IP_POST_ROUTING  Just before outbound packets "hit the wire".
		    invoked in ip_output().


The NF_IP_PRE_ROUTING hook is the first one that will be invoked when
a packet arrive. The different tables will invoke different functions
for different hooks. Finnaly, each function has to deal with the
policy matched by invoking ipt_do_tables() which can be found in
/usr/src/linux-2.6.33.4/net/ipv4/netfilter/ip_tables.c. Netfilter
defined 3 default tables for different uses. You can see the Table
below:

Table 2: Tables, Hooks and Policy

*-------------------------------------------------------------------------------------------*
|-[Table Name]-|----[ Hook Name]----|---[ Policy Functions]---|----[ Description ]----------|
|              |                    | linux-2.6.33.4/net/ipv4/netfilter/nf_nat_standalone.c |              
|              | NF_IP_PRE_ROUTING  | nf_nat_in               | Translation work of ip      |
|----=[nat]=---| NF_IP_POST_ROUTING | nf_nat_out              | address and network port    |
|              | NF_IP_LOCAL_OUT    | nf_nat_local_in         |                             |
|-------------------------------------------------------------------------------------------|
|              |                    | linux-2.6.33.4/net/ipv4/netfilter/iptable_filter.c    |
|              | NF_IP_LOCAL_IN     | ipt_local_in_hook       | Access control for packet   |
|--=[filter]=--| NF_IP_FORWARD      | ipt_hook                |                             |
|              | NF_IP_LOCAL_OUT    | ip_local_out_hook       |                             |
--------------------------------------------------------------------------------------------|
|              |                    | linux-2.6.33.4/net/ipv4/netfilter/iptable_mangle.c    |
|              | NF_IP_PRE_ROUTING  | ipt_pre_routing_hook    |                             |
|--=[mangle]=--| NF_IP_LOCAL_IN     | ipt_local_in_hook       | Tagging the packet to       |
|              | NF_IP_FORWARD      | ipt_forward_hook        | mangling the options like   |
|              | NF_IP_LOCAL_OUT    | ipt_local_hook          | TTL, TOS, etc               |
|              | NF_IP_POST_ROUTING | ipt_post_routing_hook   |                             |
*-------------------------------------------------------------------------------------------*

the filter table Description: What's the most important feature of
Netfilter? Filtering the packet. That's why this table is the most
important. If you want a effective filter rule, insert it to the
first.

the nat table Description: It does exist in 3 chains. The
implementation of Netfilter's nat table is based on connection
tracking for the supporting source NAT, Destination NAT and some
address translation mode including 1-to-1, many-to-1,
many-to-many. Because it's based on connection tracking, so the nat
table would only process new/related packet. The other state's packet
will direct to address translation according to NAT information of
connection tracking. NAT uses different methods to deal with different
protocols. NAT would only modify a few of source IP, destination IP,
source port or destination port if the packet is tcp or udp. But it
will modify the segments of id, type or code if the packet is icmp.

the mangle table's Description: It does exist in 5 chains. Netfilter
does not use the table mangle usually. The mangle table is used to
modify the TTL, TOS or tagging the mark for packet. TTL is used to
calculate how many routers the packet will pass in transportation. TOS
decides the priority of the packet. Tagging mark is used to deal with
policy route when you have more than 1 ISP wired in.

The process of a packet traversing the Netfilter is displayed in the
Figure below:

Figure 1: Traverse the Netfilter

​                               +--------------+
​                            /->| local socket |--\
  User space              /    +--------------+    \
------------------------/----------------------------\----------------------------
  Kernel space        /                               |
​                     |                               \*/                                   
​                 +----------------+           +-----------------+
​                 | NF_IP_LOCAL_IN |           | NF_IP_LOCAL_OUT |
​                 +----------------+           +-----------------+
​                              /*\                              |
​                               |                               | 
packet-in                      |                               |
   *-------------------*     $--------$                        |                   packet-out
-->|    SNAT           |     | route  |    +---------------+  \*/  *-------------* 
   | NF_IP_PRE_ROUTING | --->| decsion|--->| NF_IP_FORWARD | ----->|    DNAT     |--->
   *-------------------*     $--------$    +---------------+       | POSTROUTING |
​                                                                   *-------------*



The hook functions will return some values to tell Netfilter what to
do then, when the hook functions are done. These values are displayed
in the Table below:

Table 3: Return code of hook function

Return Code          Meaning
  NF_DROP        Discard the packet.
  NF_ACCEPT      Keep the packet.
  NF_STOLEN      Forget about the packet.
  NF_QUEUE       Queue packet for userspace.
  NF_REPEAT      Call this hook function again.

You can see the description of Bioforge's article[1] about these
return value: 

"The NF_DROP return code means that this packet should be dropped
completely and any resources allocated for it should be
released. NF_ACCEPT tells Netfilter that so far the packet is still
acceptable and that it should move to the next stage of the network
stack. NF_STOLEN is an interesting one because it tells Netfilter to
"forget" about the packet.  What this tells Netfilter is that the hook
function will take processing of this packet from here and that
Netfilter should drop all processing of it.  This does not mean,
however, that resources for the packet are released. The packet and
it's respective sk_buff structure are still valid, it's just that the
hook function has taken ownership of the packet away from Netfilter.
Unfortunately I'm not exactly clear on what NF_QUEUE really does so
for now I won't discuss it.  The last return value, NF_REPEAT requests
that Netfilter calls the hook function again. Obviously one must be
careful using NF_REPEAT so as to avoid an endless loop."

The netfilter will send the packets to the userspace programs(such as
Snort) after NF_QUEUE return.

------[ 1.1.1 Iptables samples

Iptables is a user-space tool that you can use it for
adding/removing/modifying firewall rules. As I said in the beginning
of this article, I'm not going to dig deeper into it. Read your "man
iptables" if you want details of how to use.

Case 1: Append a rule to the NF_IP_LOCAL_IN hook of the filter table,
which the rule is to drop all packets that source IP address is
192.168.0.10 trying to pass to the Host. Then list the filter table's
rules.

root@slackware-13.1:/home/forsaken# iptables -A INPUT -s 192.168.0.10 -j DROP
root@slackware-13.1:/home/forsaken# iptables -L
Chain INPUT (policy ACCEPT)
target     prot opt source               destination         
DROP       all  --  192.168.0.10        anywhere            

Chain FORWARD (policy ACCEPT)
target     prot opt source               destination         

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination  


Case 2: Insert a rule to the NF_IP_POST_ROUTING hook of the mangle
table, which the rule is to drop all packets that destination IP
address is 192.168.0.10.

root@slackware-13.1:/home/forsaken# iptables -t mangle -F
root@slackware-13.1:/home/forsaken# iptables -t mangle -I POSTROUTING -d 192.168.0.10 -j DROP
root@slackware-13.1:/home/forsaken# iptables -t mangle -L
Chain PREROUTING (policy ACCEPT)
target     prot opt source               destination         

Chain INPUT (policy ACCEPT)
target     prot opt source               destination         

Chain FORWARD (policy ACCEPT)
target     prot opt source               destination         

Chain OUTPUT (policy ACCEPT)
target     prot opt source               destination         

Chain POSTROUTING (policy ACCEPT)
target     prot opt source               destination         
DROP       all  --  anywhere             slackware-13.1.org 


----[ 1.2 Write your own hook function

Before invoking the function nf_register_hook(), we need to declare a
structure and initialize it. The declaration of the structure is
nf_hook_ops which can be found it in
/usr/src/linux-2.6.33.4/include/linux/netfilter.h.

struct nf_hook_ops {
	struct list_head list;

​	/* a pointer to function */
​	nf_hookfn *hook;
​	struct module *owner;
​	/* protocol family, we use IPv4 in case */
​	u_int8_t pf;
​	/* which hook point we hook up */
​	unsigned int hooknum;
​	/* Hooks are ordered in ascending priority. */
​	int priority;
};

Your hook function's prototype is like below:

typedef unsigned int nf_hookfn(unsigned int hooknum,
			       struct sk_buff *skb,
			       const struct net_device *in,
			       const struct net_device *out,
			       int (*okfn)(struct sk_buff *));


Let's read the source code to initialize the structure. This snippet
code is part of our source code samples. You might be interested in
reading the complete one. It's quiet easy to understand!

static int init_filter_if()
{
	printk("initializing the hooks!\n");

​	/* remember which hook you specified */
​	nfho.hook = check_tcp_packet;
​	nfho.hooknum = NF_IP_PRE_ROUTING;
​	nfho.pf = PF_INET; /* ipv4 protocols */
​	nfho.priority =NF_IP_PRI_FIRST;

​	nf_register_hook(&nfho);

​	return 0;
}


----[ 1.3 What can Netfilter do

Netfilter can do a lot of hacks that will depend on how brilliant
ideas you have. You can do:

---> Implementation of firewall, eg: netfilter/iptables[4] are the best case.
---> Implementation of KIDS[5]
---> Protocol-based and application-based systems, eg: Bioforge's ftp-sniffer is a good example.

I'm a man who is lack of creative imagination. So I just listed these
I knew. I believe you can do more hacks on Netfilter-_-


------[ 1.3.1 Other important components in Netfilter

Of course, connection tracking is one of the important components in
Netfilter framework. Connection tracking provides a kind of mechanism
to track the network connections. Connection tracking is the key of
implementation of the NAT and stateful firewall. The connection state
is completely independent of any upper-level state, such as TCP's
state. Because connection tracking only concerns about packets which
are passing the hooks of PREROUTING and POSTROUTING. Netfilter
connection can be manipulated by the user-space tool "conntrack" and
be used of checking the states with Iptables. Here I list some common
states (Referenced from Wikipedia):

*-------------------------------------------------------------------------------*
|NEW          | trying to create a new connection                               |
|-------------------------------------------------------------------------------|
|ESTABLISHED  | part of an already-existing connection                          |
|-------------------------------------------------------------------------------|
|             | assigned to a packet that is initiating a new connection and    |
| RELATED     | which has been "expected". The aforementioned mini-ALGs set up  |
|             | these expectations, for example, when the nf_conntrack_ftp      |
|             | module sees an FTP "PASV" command.                              |
|-------------------------------------------------------------------------------|
|INVALID      | the packet was found to be invalid, e.g. it would not adhere    |
|             | to the TCP state diagram.                                       |
|-------------------------------------------------------------------------------|
|UNTRACKED    | is a special state that can be assigned by the administrator to |
|             | bypass connection tracking for a particular packet (raw table)  |
*-------------------------------------------------------------------------------*


--[ 2. Linux networking systems: A monkey-coder's perspective

This part will discuss the linux kernel's network sub-systems
including the NIC driver's initialization, delivery/receipt of
packets, IP packet's processing.


----[ 2.1 Initialization of the NIC driver

As ELDD[6] said, "NIC drivers are different from other driver classes
in that they do not rely on /dev or /sys to communicate with user
space. Rather, applications interact with a NIC driver via a network
interface (for example, eth0 for the first Ethernet interface) that
abstracts an underlying protocol stack.". By using the userspace tool
"ifconfig" can manipulate the NIC driver, which provides a set of
interfaces to communicate with NIC hardware (eg: rtl8169_open will be
invoked after running the command "ifconfig eth0 up").

Network Interface Cards usually are treated as the PCI (or USB in a
few cases) device objects in the linux kernel. There's a simple way to
understand the process of initialization of the RealTek 8169 NIC
driver that is displayed in the figure below:

Figure 2: Initialization of the NIC driver

​    +---------------------------+
​    | Loading the driver module |
​    +---------------------------+
​                |
​                |
​               \*/                                                *------*
​       +-----------------------+                                  | exit |
​       | rtl8169_init_module() |                                  *------*
​       +-----------------------+                                     /|\
​                |                                                     |
​                |                                                     | N
​               \*/                                                    |
​         +-----------------------+    +-------------------+    $=============$
​         | pci_register_driver() |--->| driver_register() |--->$ driver_find $
​         +-----------------------+    +-------------------+    $=============$
​                                                                      |
​                                                                      |
​                                                                     \|/
​                                                            +------------------+
​                                                            | bus_add_driver() |
​                                                            +------------------+
​                                                                      |
​                                                                     \|/
​                                                             +-----------------+
​                                                             | driver_attach() |
​                                                             +-----------------+
​                                      Iteration                        |
​                                  +--------------------+               |
​                                  |  __driver_attach() |               |
​                                  +--------------------+               |
​                                      |           /|\                 \|/
​                                      |            |         $====================$
​                                      |            +---------$ bus_for_each_dev() $
​                                     \|/                     $====================$
​                              +--------------------+                                   
​                              | driver_probe_dev() |
​                              +--------------------+
​                                      |
​                                      |
​                                     \|/
​                              +--------------------+                                   
​                              | pci_device_probe() |
​                              +--------------------+
​                                      |
​                                      |
​                                     \|/
​                             +----------------------+    +------------------+    +-------------------+
​                             | __pci_device_probe() |--->| pci_call_probe() |--->| local_pci_probe() |
​                             +----------------------+    +------------------+    +-------------------+
​                                                                                          |
​                                                                                          |
​                                                                                         \|/
​                                                                                  *--------------------*
​                                                                                  | rtl8169_init_one() |
​                                                                                  *--------------------*

I suggest that you should read the kernel's Documentation[7], while
looking into the source code. The entry point and exit point of the
implementation in rtl8169 dirver are rtl8169_init_module() and
rtl8169_cleanup_module() defined in the source code:

module_init(rtl8169_init_module);
module_exit(rtl8169_cleanup_module);

The rtl8169_init_module() function will be invoked after "insmod" your
driver module. And you can see the function is only doing one thing:

static int __init rtl8169_init_module(void)
{
	return pci_register_driver(&rtl8169_pci_driver);
}

The argument "rtl8169_pci_driver" is a structure of the pci_driver
which can be found in src/include/linux/pci.h

struct pci_driver {
	struct list_head node;
	char *name;
	const struct pci_device_id *id_table;	/* must be non-NULL for probe to be called */
	int  (*probe)  (struct pci_dev *dev, const struct pci_device_id *id);	/* New device inserted */
	void (*remove) (struct pci_dev *dev);	/* Device removed (NULL if not a hot-plug capable driver) */
	int  (*suspend) (struct pci_dev *dev, pm_message_t state);	/* Device suspended */
	int  (*suspend_late) (struct pci_dev *dev, pm_message_t state);
	int  (*resume_early) (struct pci_dev *dev);
	int  (*resume) (struct pci_dev *dev);	                /* Device woken up */
	void (*shutdown) (struct pci_dev *dev);
	struct pci_error_handlers *err_handler;
	struct device_driver	driver;
	struct pci_dynids dynids;
};

As you see the above structure contains some function pointers to your
own implementations for the NIC drivers. Let's see the rtl8169
driver's initialization for the structure:

static struct pci_driver rtl8169_pci_driver = {
	.name		= MODULENAME,
	.id_table	= rtl8169_pci_tbl,
	.probe		= rtl8169_init_one,
	.remove		= __devexit_p(rtl8169_remove_one),
	.shutdown	= rtl_shutdown,
	.driver.pm	= RTL8169_PM_OPS,
};

The information of the id table "rtl8169_pci_tbl" is related with the
implemenation of PCI architecture in linux kernel. And the prototype
of the rtl8169_init_one() function is displayed below:

static int __devinit
rtl8169_init_one(struct pci_dev *pdev, const struct pci_device_id *ent);

Where did you get these 2 parameters? Don't forget which function is
the caller: As you can see in above figure, it's
local_pci_probe(). These 2 parameters are created in PCI bus
enumerations.

static long local_pci_probe(void *_ddi)
{
        struct drv_dev_and_id *ddi = _ddi;

​        return ddi->drv->probe(ddi->dev, ddi->id);
}

The declaration of the _ddi's structure can be found in
src/drivers/pci/pci-driver.c

struct drv_dev_and_id {
	struct pci_driver *drv;
	struct pci_dev *dev;
	const struct pci_device_id *id;
};

The driver will do a lot of things in rtl8169_init_one(), such as
memory mapping, allocation for network device, setting up DMA,
etc. But We have to care about one line of source in
rtl8160_init_one():

​	netif_napi_add(dev, &tp->napi, rtl8169_poll, R8169_NAPI_WEIGHT);

This one is about the softirq we will talk about it later.


----[ 2.2 RX packets

While you are trying to turn on (eg: ifconfig eth0 up) a Ethernet
interface, it will try to register a interrupt number by invoking
request_irq() in the rtl8169_open() funcion:

retval = request_irq(dev->irq, rtl8169_interrupt, (tp->features &
			     RTL_FEATURE_MSI) ? 0 : IRQF_SHARED,
			     dev->name, dev);

The NIC hardware will rise a interrupt to CPU when the NIC recieves
packets from network and then linux kernel start to execute the
interrupt handler (we use rtl8169_interrupt() in case) for processing
packets. In this article, we need to know a little concepts of
hardware interrupt. The other work flow of hardware interrupt is a
tough topic that beyond the range of this article. There is another
great paper[8] from phrack, which is worth reading.

After initializing the IDT (Interrupt Descriptor Table) in the kernel
booting stage. When a hardware device raises an interrupt to CPU, the
assembly code will execute at first, then it will jump to the familiar
C code function do_IRQ() which can be found in
src/arch/x86/kernel/entry_32.S:

/*
 * Build the entry stubs and pointer table with some assembler magic.
 * We pack 7 stubs into a single 32-byte chunk, which will fit in a
 * single cache line on all modern x86 implementations.
 */
  .section .init.rodata,"a"
  ENTRY(interrupt)
  .text
	.p2align 5
	.p2align CONFIG_X86_L1_CACHE_SHIFT
  ENTRY(irq_entries_start)
	RING0_INT_FRAME
  vector=FIRST_EXTERNAL_VECTOR
  .rept (NR_VECTORS-FIRST_EXTERNAL_VECTOR+6)/7
	.balign 32
    .rept	7
    .if vector < NR_VECTORS
      .if vector <> FIRST_EXTERNAL_VECTOR
	CFI_ADJUST_CFA_OFFSET -4
      .endif
  1:	pushl $(~vector+0x80)	/* Note: always in signed byte range */
	CFI_ADJUST_CFA_OFFSET 4
      .if ((vector-FIRST_EXTERNAL_VECTOR)%7) <> 6
	jmp 2f
      .endif
      .previous
	.long 1b
      .text
  vector=vector+1
    .endif
    .endr
  2:	jmp common_interrupt
  .endr
  END(irq_entries_start)

See, the common code starts at label common_interrupt and consists of
the following assembly language macros and instructions:

/*
 * the CPU automatically disables interrupts when executing an IRQ vector,
 * so IRQ-flags tracing has to follow that:
 */
	.p2align CONFIG_X86_L1_CACHE_SHIFT
	common_interrupt:
	addl $-0x80,(%esp)	/* Adjust vector into the [-256,-1] range */
	SAVE_ALL
	TRACE_IRQS_OFF
	movl %esp,%eax
	call do_IRQ
	jmp ret_from_intr
	ENDPROC(common_interrupt)
	CFI_ENDPROC

Then, we get to the C code do_IRQ() function after executing "call
do_IRQ". By invoking the fuc handle_irq() in do_IRQ() which can be
found in src/arch/x86/kernel/irq.c:

/*
 * do_IRQ handles all normal device IRQ's (the special
 * SMP cross-CPU interrupts have their own specific
 * handlers).
 */
  unsigned int __irq_entry do_IRQ(struct pt_regs *regs)
  {
	struct pt_regs *old_regs = set_irq_regs(regs);

	/* high bit used in ret_from_ code  */
	unsigned vector = ~regs->orig_ax;
	unsigned irq;

	exit_idle();
	irq_enter();

	irq = __get_cpu_var(vector_irq)[vector];

	if (!handle_irq(irq, regs)) {
		ack_APIC_irq();

	​	if (printk_ratelimit())
	​		pr_emerg("%s: %d.%d No irq handler for vector (irq %d)\n",
	​			__func__, smp_processor_id(), vector, irq);
	}

	irq_exit();

	set_irq_regs(old_regs);
	return 1;
  }

Finally, the handle_irq() function calls the rtl8169_interrupt()
function by a function pointer "desc->handle_irq(irq, desc)", which
can be found in src/arch/x86/kernel/irq_32.c. Now the packet got into
the interrupt implementation of the NIC driver:

bool handle_irq(unsigned irq, struct pt_regs *regs)
{
	struct irq_desc *desc;
	int overflow;

​	overflow = check_stack_overflow();

​	desc = irq_to_desc(irq);
​	if (unlikely(!desc))
​		return false;

​	if (!execute_on_irq_stack(overflow, desc, irq)) {
​		if (unlikely(overflow))
​			print_stack_overflow();
​		desc->handle_irq(irq, desc);
​	}

​	return true;
}


Many NIC drivers now are using NAPI's strategy that uses polling mode
while many hardware interrupts are rarising in period of time, and
then turn back to interrupt mode when not many packets need
processing. This is the best solution to avoid the large number of
hardware interrupts which might exhaust the CPU. There's a few steps
to go through with it:

1, In interrupt mode, the interrupt handler rtl8169_interrupt() posts
receive packets to protocol layers by scheduling NET_RX_SOFTIRQ:

​	if (likely(napi_schedule_prep(&tp->napi)))
​		__napi_schedule(&tp->napi);

It then disables NIC intetrrupts and switches to polling mode by
invoking __napi_schedule() to add the devices to a poll list:

/**
 * __napi_schedule - schedule for receive
 * @n: entry to schedule
 *
 * The entry's receive function will be scheduled to run
 */
  void __napi_schedule(struct napi_struct *n)
  {
	unsigned long flags;

	local_irq_save(flags);
	list_add_tail(&n->poll_list, &__get_cpu_var(softnet_data).poll_list);
	__raise_softirq_irqoff(NET_RX_SOFTIRQ);
	local_irq_restore(flags);
  }

Both receipt and transmission methods of softirqs are registered in
net_dev_init() which can be found in src/net/core/dev.c:

​        open_softirq(NET_TX_SOFTIRQ, net_tx_action);
​        open_softirq(NET_RX_SOFTIRQ, net_rx_action);

2, By invoking rtl8169_poll() in the net_rx_action() function which
can be found in src/net/core/dev.c:

​	if (test_bit(NAPI_STATE_SCHED, &n->state)) {
​		work = n->poll(n, weight);
​		trace_napi_poll(n);
​	}

3, In the polling mode, the rtl8169_poll() processes packets in the
ingress queue. When the queue becomes empty, the driver re-enables
interrupts and switches back to interrupt mode by calling
napi_complete():

​	if (unlikely(work == weight)) {
​		if (unlikely(napi_disable_pending(n))) {
​			local_irq_enable();
​			napi_complete(n);
​			local_irq_disable();
​		} else
​			list_move_tail(&n->poll_list, list);
​	}


Figure 3: The process of RX packets

---------------------------------------------------------------------------------------------------------------------------
​       +-----+                                              |
​       | NIC |                                              |
​       +-----+                                              |
​          |                                                 |
​          | Raise a interrupt                               |
​         \|/                                                |
​    *-----------------------*                               |
​    | CPU-1 | CPU-2 | CPU-N |                               |
​    *-----------------------*                               |
​                        |                                   |
​                        | Interrupt[n]                      |
​                       \|/                                  |    *---------------------*
​                  +-----------+                             |    | softnet_data[CPU-n] |-----------+
​                  | do_IRQ(n) |                             |    *---------------------*           |
​                  +-----------+                             |            /*\                       |
​                        |                                   |             | add to poll list       |
​                       \|/                                  |             |                        | raise softirq
​                +--------------+    +---------------------+ |    +-------------------+             |
​                | handle_irq() |--->| rtl8169_interrupt() |----> | __napi_schedule() |             |
​                +--------------+    +---------------------+ |    +-------------------+             |
​                                                            |                                     \|/
​                                                            |                             +-----------------+
​                                                            |                             | net_rx_action() |          
​                                                            |                             +-----------------+
​                         $================$                 |  $==============$                    |
​                         $ Interrupt mode $                 |  $ Polling mode $                    |
​                         $================$                 |  $==============$                   \|/
​                                /*\                         |                            +----------------+
​                                 |                          |                            | rtl8169_poll() |          
​                                 |                          |                            +----------------+
​                                 |                          |                                     |
​                                 |                          |                          Work of RX |
​                                 |                          |                                    \|/  
​                                 |                          |                            +------------------+
​                                 |                          |            +---------------| eth_type_trans() |
​                                 |                          |            |               +------------------+
​                                 |                          |           \|/
​                                 |                          |      $===========$   Y   +-----------------------+            
​                                 |                          |      $  IS_VLAN  $------>| rtl8169_rx_vlan_skb() |
​                                 |                          |      $===========$       +-----------------------+
​                                 |                          |            |                        |
​                                 |                          |          N |                        |
​                                 |                          |           \|/                       |
​                                 |                          |   +---------------------+           |
​                                 |                          |   | netif_receive_skb() |---------->|
​                                 |                          |   +---------------------+           |
​                                 |                                                                |
​                                 |                                                               \|/
​                                 |              Yes, done the packet processing         $-----------------$
​                                 +------------------------------------------------------| napi_complete() |
​                                                                                        $-----------------$


There will be 5 steps to start running when the packet travels to
rtl8169_rx_interrupt:

1, netdev_alloc_skb() in rtl8169_alloc_rx_skb(), allocate a
receive buffer

2, skb_reserve(), add a 2-byte padding between the start of the packet
buffer and the beginning of the payload for align with IP header which
is 16-byte.

3, NIC hardware maps a memory space from DMA to memory. Copy the data
in DMA into a preallocated sk_buff when the data arrives.

4, skb_put(), extend the used data area of the buffer.

5, netif_receive_skb(), enqueue the packet for upper protocols/levels
to process.


----[ 2.3 TX packets

This part is not going to discuss the whole protocol stacks in linux
kernel. We intend to focus on how the driver layer works in the
process of transmitting packets when it crosses the POSTROUTING.

Each NIC has its own buffer for packets (ring buffer). Kernel will
write packets into the buffer and send TX instructions to control
register. The NIC takes packets from the buffer and hits the wire. The
linux kernel will copy the packets to kernel space by invoking the
memcpy_fromiovec() function which is invoked by packet_snd() function,
which invoked is by the packet_sendmsg() function, which the source
code can be found in src/net/packet/af_packet.c, when upper-level
protocols have already prepared the packet:

​	err = memcpy_fromiovec(skb_put(skb, len), msg->msg_iov, len);

The initialization of the structure proto_ops is in
src/net/packet/af_packet.c. This structure includes function pointer
to kernel implementations:

static const struct proto_ops packet_ops = {
	.family =	PF_PACKET,
	.owner =	THIS_MODULE,
	.release =	packet_release,
	.bind =		packet_bind,
	.connect =	sock_no_connect,
	.socketpair =	sock_no_socketpair,
	.accept =	sock_no_accept,
	.getname =	packet_getname,
	.poll =		packet_poll,
	.ioctl =	packet_ioctl,
	.listen =	sock_no_listen,
	.shutdown =	sock_no_shutdown,
	.setsockopt =	packet_setsockopt,
	.getsockopt =	packet_getsockopt,
	.sendmsg =	packet_sendmsg,
	.recvmsg =	packet_recvmsg,
	.mmap =		packet_mmap,
	.sendpage =	sock_no_sendpage,
};

Linearize the buffer and do the checksum by invoking dev_queue_xmit(),
which can be found in src/net/core/dev.c:

​	/* GSO will handle the following emulations directly. */
​	if (netif_needs_gso(dev, skb))
​		goto gso;

​	if (skb_has_frags(skb) &&
​	    !(dev->features & NETIF_F_FRAGLIST) &&
​	    __skb_linearize(skb))
​		goto out_kfree_skb;

​	/* Fragmented skb is linearized if device does not support SG,
​	 * or if at least one of fragments is in highmem and device
​	 * does not support DMA from it.
​	 */
​		if (skb_shinfo(skb)->nr_frags &&
​	    (!(dev->features & NETIF_F_SG) || illegal_highdma(dev, skb)) &&
​	    __skb_linearize(skb))
​		goto out_kfree_skb;

	/* If packet is not checksummed and device does not support
	 * checksumming for this protocol, complete checksumming here.
	 */
	 if (skb->ip_summed == CHECKSUM_PARTIAL) {
		skb_set_transport_header(skb, skb->csum_start -
					      skb_headroom(skb));
		if (!dev_can_checksum(dev, skb) && skb_checksum_help(skb))
			goto out_kfree_skb;
	 }

And queue a buffer for transmission to a network device by invoking
the __dev_xmit_skb() function, as you can see below code snippet:

​		/*
​		 * This is a work-conserving queue; there are no old skbs
​		 * waiting to be sent out; and the qdisc is not running -
​		 * xmit the skb directly.
​		 */
​			__qdisc_update_bstats(q, skb->len);
​			if (sch_direct_xmit(skb, q, dev, txq, root_lock))
​			__qdisc_run(q);

Finnaly, raise a softirq of TX by invoking the __netif_schedule()
function in __qdisc_run():

​	while (qdisc_restart(q)) {
​		/*
​		 * Postpone processing if
​		 * 1. another process needs the CPU;
​		 * 2. we've been doing it for too long.
​		 */
​		 if (need_resched() || jiffies != start_time) {
​			 __netif_schedule(q);
​			 break;
​		 }
​		 }

In the func __netif_reschedule(), the softirq has been raised:

​	raise_softirq_irqoff(NET_TX_SOFTIRQ);

The softirq handler is registered, while kernel is booting, which can
be found in the func net_dev_init() in src/net/core/dev.c:

​	open_softirq(NET_TX_SOFTIRQ, net_tx_action);

net_tx_action() calls qdisc_restart() which has:

​	HARD_TX_LOCK(dev, txq, smp_processor_id());
​	if (!netif_tx_queue_stopped(txq) && !netif_tx_queue_frozen(txq))
​		ret = dev_hard_start_xmit(skb, dev, txq);

​	HARD_TX_UNLOCK(dev, txq);

dev_hard_start_xmit() will call the func rtl8169_start_xmit() by
invoking *->ndo_start_xmit():

​		rc = ops->ndo_start_xmit(skb, dev);

Then your dirver's implementation of transmission
function(rtl8169_start_xmit()) will be invoked. The process of the
figure is displayed below:


Figure 4: The process of TX packets


​                       $=======================$
-----------------------$ Upper-level protocols $-------------------------------------------
​                       $=======================$
​                                   |
​                                   |
​                                  \|/
​                         +------------------+
​                         | packet_sendmsg() |
​                         +------------------+
​                                   |
​                                  \|/
​                         +--------------+
​                         | packet_snd() |
​                         +--------------+
​                                   |
​                                  \|/
​                         +--------------------+      +------------------+      No queue
​                         | memcpy_fromiovec() |----->| dev_queue_xmit() |----------------+
​                         +--------------------+      +------------------+                | 
​                                                             |                           |
​                                                             | Y                         |
​                                                            \|/                          |
​                                                     +------------------+                |
​                                                     | __dev_xmit_skb() |                |
​                                                     +------------------+                |
​                                                             |                           |
​                                                            \|/                          |
​                           +-----------------+          +---------------+                |
​                +--------> | qdisc_restart() |<---------| __qdisc_run() |                |
​                |          +-----------------+          +---------------+                |
​                |                  |                                                     |
​                |                  |                                                     |
​                |                 \|/                                                    |
​                |      +--------------------+                                            |
​                |      | __netif_schedule() |                                            |
​                |      +--------------------+                                            |
​                |                  |                                                    \|/
​                |                  |           +-----------------+     +-----------------------+
​                |                  +---------->| net_tx_action() |---->| dev_hard_start_xmit() |
​                |              Raise a softirq +-----------------+     +-----------------------+
​                |                                      |                           |
​                |                                      |                          \|/
​                |                                      |                 +----------------------+
​                |              If Queue is not empty   |                 | rtl8169_start_xmit() |
​                +--------------------------------------+                 +----------------------+



----[ 2.4 Three ways of packet's traveling

Linux kernel supports many network protocols which have different
implementations. We will only use IPv4 to descrbe 3 ways of packet
flows which bypass the netfilter.


------[ 2.4.1 Network to Host

Firstly, register the handlers for different protocols by using the
dev_add_pack() function while kernel is booting, such as IPv4's
handlers registration in the inet_init() function which can be found
in src/net/ipv4/af_inet.c:

​	dev_add_pack(&ip_packet_type);

Which the structure has defined in the same source file:

/*
 *	IP protocol layer initialiser
 */

static struct packet_type ip_packet_type __read_mostly = {
	.type = cpu_to_be16(ETH_P_IP),
	.func = ip_rcv,
	.gso_send_check = inet_gso_send_check,
	.gso_segment = inet_gso_segment,
	.gro_receive = inet_gro_receive,
	.gro_complete = inet_gro_complete,
};

After registering the protocol handlers, the .func function pointer
will be invoked by netif_receive_skb() in driver's softirq handler (we
use rtl8169_rx_interrupt() in case):

​	if (pt_prev) {
​		ret = pt_prev->func(skb, skb->dev, pt_prev, orig_dev);

After packet's sanity checking, the packet goes to the
NF_IP_PRE_ROUTING hook for filtering rules. Then it will enter into
the ip_rcv_finish() function, which looks up the route depending on
destination IP address. If the destination IP address is matches with
local NIC's IP address, the dst_input() function will brings the packets
into the ip_local_deliver(), which will defrag the packet and pass it
to the NF_IP_LOCAL_IN hook:

/* Input packet from network to transport.  */
static inline int dst_input(struct sk_buff *skb)
{
	return skb_dst(skb)->input(skb);
}

In the end, invoke the protocol handler in the
ip_local_deliver_finish() function:

​			ret = ipprot->handler(skb);

Then, the upper-level protocol will continue to process the packet.


------[ 2.4.2 Network to Network

After the filtering of the NF_IP_PRE_ROUTING hook, look up the route
by invoking the ip_rcv_finish() function, and through the
skb_dst(skb)->input() enter into the ip_forward() function which does
validate checks including checking the packet type:

​	if (skb->pkt_type != PACKET_HOST)
​		goto drop;

Decrease the TTL, check whether the packet is allowed to defragment,
check the length of the packet which should not be bigger than MTU,
etc:

​	/*
​	 *	According to the RFC, we must first decrease the TTL field. If
​	 *	that reaches zero, we must reply an ICMP control message telling
​	 *	that the packet's lifetime expired.
​	 */
​		if (ip_hdr(skb)->ttl <= 1)
​		goto too_many_hops;

	if (!xfrm4_route_forward(skb))
		goto drop;
	
	rt = skb_rtable(skb);
	
	if (opt->is_strictroute && rt->rt_dst != rt->rt_gateway)
		goto sr_failed;
	
	if (unlikely(skb->len > dst_mtu(&rt->u.dst) && !skb_is_gso(skb) &&
		     (ip_hdr(skb)->frag_off & htons(IP_DF))) && !skb->local_df) {
		IP_INC_STATS(dev_net(rt->u.dst.dev), IPSTATS_MIB_FRAGFAILS);
		icmp_send(skb, ICMP_DEST_UNREACH, ICMP_FRAG_NEEDED,
			  htonl(dst_mtu(&rt->u.dst)));
		goto drop;
	}

Then, by invoking the ip_forward_finish() call the skb_dst(skb)->ouput
entering into the ip_output() after the NF_IP_FORWARD hook. Finally,
it will arrive the NF_IP_POST_ROUTING hook.


------[ 2.4.3 Host to Network

This is the last type of the direction of packet's traveling. When
userspace program uses socket to send the packet, the packet will
traverse a lot of functions into the NIC driver in the end.

The ip_queue_xmit() function is the key function in network layer
which is provided by linux kernel. The packet looks up the route in the
ip_queue_xmit() and sets some segments, such as defragment flag,
then passes it to the NF_IP_LOCAL_OUT hook for filtering:

​	/* OK, we know where to send it, allocate and build IP header. */
​	skb_push(skb, sizeof(struct iphdr) + (opt ? opt->optlen : 0));
​	skb_reset_network_header(skb);
​	iph = ip_hdr(skb);
​	*((__be16 *)iph) = htons((4 << 12) | (5 << 8) | (inet->tos & 0xff));
​	if (ip_dont_fragment(sk, &rt->u.dst) && !ipfragok)
​		iph->frag_off = htons(IP_DF);
​	else
​		iph->frag_off = 0;
​	iph->ttl      = ip_select_ttl(inet, &rt->u.dst);
​	iph->protocol = sk->sk_protocol;
​	iph->saddr    = rt->rt_src;
​	iph->daddr    = rt->rt_dst;

Then, invoke the ip_output() function by dst_output() function which
can be found in src/include/net/dst.h:

/* Output packet to network from transport.  */
static inline int dst_output(struct sk_buff *skb)
{
	return skb_dst(skb)->output(skb);
}

After filtering in the NF_IP_POST_ROUTING hook, the packet will
deliver to the lower layer handlers.


----[ 2.5 A bigger picture

Now, hope the last figure can help you understand the complete process
of a packet's rx/tx:


+-------------------------------------------------------------------------------------------------------------+
|                       A P P L I C A T I O N                L A Y E R                                        |  
+-------------------------------------------------------------------------------------------------------------+
                        /*\                                                                      \|/
                         |                                                               +-----------------+
                         |                                                               | ip_queue_xmit() |
                         |                                                               +-----------------+
                         |                                                                        |
   ipprot->handler(skb)  |                                                                       \|/
          +---------------------------+                                                  +----------------+             
          | ip_local_deliver_finish() |                                                  | ip_local_out() |
          +---------------------------+                                                  +----------------+
                      /*\                         +---------------------+                         |
                       |                          | ip_forward_finish() |------+                 \|/
               $================$                 +---------------------+      |          $=================$
               $ NF_IP_LOCAL_IN $    +-------------+     /*\                   |          $ NF_IP_LOCAL_OUT $
               $================$<---| ip_defrag() |      |                    |          $=================$
                       /*\           +-------------+      |                    |                   |
                        |               /*\          $===============$         |                  \|/
               +--------------------+    |           $ NF_IP_FORWARD $         |            +--------------+
               | ip_local_deliver() |----+           $===============$         |            | dst_output() |
               +--------------------+                   /*\                    |            +--------------+
                       /*\                               |                     |                   |
        dst_input(skb)  |                      +--------------+                |                  \|/
                +-----------------+            | ip_forward() |                +---------> +-------------+
                | ip_rcv_finish() |-------+    +--------------+                            | ip_output() |
                +-----------------+       |        /*\                                     +-------------+
                       /*\               \|/        |                                             |
                        |            +------------------+                                        \|/
               $===================$ | ip_route_input() |                               $====================$
               $ NF_IP_PRE_ROUTING $ +------------------+               +---------------$ NF_IP_POST_ROUTING $
               $===================$                                    |               $====================$
                         /*\                                           \|/
                          |                                    +--------------------+     
+-----------+          +----------+                            | ip_finish_output() |
| arp_rcv() |          | ip_rcv() |                            +--------------------+
+-----------+          +----------+                                     |
  /*\                     /*\                                          \|/
   |                       |                                   +---------------------+
   +----+             +----+                                   | ip_finish_output2() |
        |             |                                        +---------------------+
        |             |         L A Y E R  III                          |
        |             |                                                 |
--------|-------------|-------------------------------------------------|-----------------------------------------------
        |             |                                                 |
     +-----------------+                                       +------------------+
     | net_rx_action() |                                       | dev_queue_xmit() |
     +-----------------+                                       +------------------+
             /|\                                                        |
              |                                                        \|/
              |                                                +------------------+
     +-----------------+                                       | __dev_xmit_skb() |
     | __napi_schedule |                                       +------------------+
     +-----------------+                                                |
              /|\                                                      \|/              
               |                                              +---------------+       +--------------------+
      +---------------------+                                 | __qdisc_run() |------>| __netif_schedule() |
      | netif_receive_skb() |                                 +---------------+       +--------------------+
      +---------------------+                                                                  |
              /|\                                                                             \|/
               | Got a packet(s)                                                  +-----------------------+
      +----------------------+                                       +------------| dev_hard_start_xmit() | 
      | rtl8169__interrupt() |                                       |            +-----------------------+
      +----------------------+                                      \|/
             /|\                                              +----------------------+
              |                                               | rtl8169_start_xmit() |
              |               L A Y E R  II                   +----------------------+      
              |                                                      |
--------------|------------------------------------------------------|----------------------------------------
              |                                                      |
              |                                                      |
              |                                                     \|/
$------------------------------------------------------------------------------------------------------------$
|           H A R D W A R E                  L E V E L                                                       |
$------------------------------------------------------------------------------------------------------------$




--[ 3. Conclusion

Netfilter is an excellent framework on both design and implementation
for networking. But netfilter has one well-known flaw is that the
connection tracking costs too much. I've tested a machine with two
4-cores CPU, 3 Gigabytes memory, Intel 8xxxx NICs. The result of the
testing was that processing the bidirectional 64-byte packets was
640Mbps without connection tracking and 330Mbps with connection
tracking. It seems to need optimization if your requirements are
performance-sensitive.

Nowadays, many commercial companies are using a cheap combination of
X86 hardware and GNU/Linux to develop their networking products. But
there are still many commercial networking products violating the
GPL. That's shame!


----[ 3.1 Gratitude

This article is dedicated to my neurons. I can't do nothing without
their faithful support. And, I must thank those great hackers
including Phrack's authors, RMS, John Carmack, LulzSec, etc. You guys
really inspired me to keep hacking on Purpose/Hack/Life. Finally, I
thank my beautiful wife for proofreading the article and helping me
fix the grammar errors.


May L0rd's hacking spirit guide us!!!


--[ 4 - References

[1] Hacking the Linux Kernel Network Stack
     bioforge. Phrack Vol 0x0b, Issue 0x3d, Phile #0x0d of 0x0f
     http://www.phrack.org/issues.html?issue=61&id=13#article

[2] GNU/Linux kernel 2.6.33.4 source code

[3] Understanding the Kernel Network Layer
    Breno Leitao& Arnaldo Carvalho
    http://stoa.usp.br/leitao/files/-1/3689/network.pdf

[4] Netfilter/Iptables Firewall
    http://www.netfilter.org/

[5] Kernel Intrusion Detection System
    http://sourceforge.net/projects/ids-kids/

[6] Sreekrishnan Venkateswaran
    "Essential Linux Device Driver", Chapter 15: Network Interface Cards

[7] Kernel Documentation
    /usr/src/linux-2.6.33.4/Documentation/driver-model/*.txt
    /usr/src/linux-2.6.33.4/Documentation/PCI/pci.txt

[8] Handling Interrupt Descriptor Table for fun and profit
    kad. Phrack Vol 0x0b, Issue 0x3b, Phile #0x04 of 0x12 
    http://www.phrack.org/issues.html?issue=59&id=4#article

begin 644 netfilter_hacks.tar.gz
M'XL(`,($"4X``^P\:W/;.)+Y*E7E/R#>22+:LBS)KSDK]J[CR(EJ'%MK.YO:
MFZ18-`5)7%$DEZ#L:&=\O_VZ&R`)/B0GMTYV[TY,8DM$H]%`/]#=:,3CT=!Q
M(QZ:8\N>B*TGW^%IPK._NTN_X<G_IL^MUEZSW8:_^]M/FJWV?FOG"=O]'L3D
MGYF(K)"Q)Z'O1\O@'FK_7_IX.?Y[0^$YP^&CRL'7\K^UO[N_B^];.]N[*_[_
MD&<1_]];$PX-_#'&>(C_.SL[Q/_F;GM[>[L-_`=9:#]AS<<8_*'G_SG_?^E>
MGG?/S#>]R\.MF0BW1&AON8XW^[+9;NPUMK<;.U4%\JY[_*9[><4.V:;[4RWM
M9VPYGNW.!KQ:]6_^MCD].%0RU/"K_8]O`/ZGFAASUV7!W<"H5BW7/:A6?JJ]
M/_ZE:[#-$Y9!QMX?_E2#;@:;^H.9RT6U,K)MMNFS$8^"._FS85>KMLLM#Q"%
M4[89#MEZ8^)K7_3/@*BQGGQ_3VBU%VJ<^,U0#I$TP_M_-8^^Y[-(_V,>VH\P
MQG+];S=W]YJ)_K>D_K=V]E;Z_R.>K75V/78$"T)_%%I3=N>`HHJQ?\?F_HQ9
MS)D&+I]R+[(BQ_>8/V3#*&`D&SQD=V/''K,;2_!!E:VS1)C8$'#Q.S^<--@[
M*PCF#*7+\4;/``PAI[XWX?--VQ_P\.!J;-UY+!IS=MFT)W^R_6#N\F%49Z]L
M)YH'=W\:32W';=C^]`C[XC^BV0^=D>-9+D,TT-^*F!.]%#"X/X5A:4!">X8&
MC?W"0X^[[)Q'2!BAN8H`2O:\"YTHXAZ[F;,;QQ_ZX8@WKL>6-Q')]SJS;OQ9
MA"L3LE'(H9<51@Y8HH::5@^MB3-T^(#&%0!H<TG>%#94((\-X9\C9SLA@LC0
MLF,/NG`104]+$&UW:#(!\NWY!VF1$:Z]6V?T^S\:>\R"/K&55A1L5:M_4.:8
MO:)>6]*^-<9'A18Y?EF+F-S,0/E+6ARO]&U0]C:R2U\[]K3T/4C/@-\Z=BFM
MB6C)QN&`#YEIJHW#K/YAYN7?+$)@.L'M#F'A'O`*%@QZ.AY?UMD9FE98/IFA
MR8&7X8*V`.2+1]A8?7_QYL-9USSKG73/K[JUM;?]LS6CDP[__OAM[\0\N7C3
M98PUO^R^3EHNN_VSOYI7O?_$ENV]M$OOY'W?[!__]>SB^(UJKXTCWQ,U)S#'
M@[`F;HS-H\B/3)=[!OM4K50J3#Z;3#C_X/ZP)J)P9H-(!@#_``CP#8%@#T>K
M\:Y[U66WECOC`M2`LYE`J?=!JGE`XOWAJGOI@1D@.>T?7UV!V@W8S(L<%^4;
M0.;4\>\S'H+&--B%Y\Z9[\F>6]B#!9832IMTPQDX$:`=$8(0`D?ACMO1)0B!
M"-^S-:R@$P*ME\WL,5CZ=:`S)+(.V?F'L[-.MC6PA"`Z<ZV.%S$P8K?<))(.
M6;-38;G,#"=!(@:B:L5*G/D>&!*IF1,U81=?T03
M3I8)[,5T"E^$-$PC'U<55@OG+)#P7I]9@T'(A:`^UR=]%OAAI$]UY@EGY,%:
M(-VPP8%/`W)/9!=`P-J'"1`BDF!(]@?%TP$7=NC`$J/E.T^L_-CW8?(T*DF(
M-S3QE>D'@L&.PNE;)Y8GP-?S8&ZX#(OZ^"(J=+J812-?=2*J3F>>3;L1K8]+
M1*`M]IB8F&BXU%X@V,3S<6?Q43J@^?0:5DIJ)"[F&?4$?B3BFO(`;+@[D.N+
MEELP,0NYE-D;/QHCCSAM-$J426['0#Z:;P<,BVU%M/S4J!;WRY<O,>*45;>^
M,P#AX_;$A*TU5K9X)NM@BHWJ;U58"M4"5A6TD*W#[PZ^EG([L"*+OB+#0=LE
M#]5W)_F&_Z`C?*_ET!DU&&GS"/&P#988D`E:$&?LPBQW#(-P$`@@D`,;M1H,
M82!2[`8?:_`9$/E(O>Q4E8P\]^_J2E64BB2ZJ%2GCJOE:0")Z#80!T-]@VU4
M\0)X')'O0BQ%?H.<1@[*=,Q4TA=D"RD'+L>0U>)1#<))KS+3':!VL6>'FN+\
M_CNC6:D=/6U#?5%X&`MY-`N]9*'EE%D4SE$$!><X%%$,?RTI<$"G,G0TAY1(
M8(\'!K>&JUUG:P2\5F>[!CL$9AKL-Y8\4E'E0DH$,9<V#MEN1[U0OS(+D"$Y
MA0&WSN6LMEY3TN`8...7G\*7[,4+5GCMO:Q*=2UK;%(?A[UB+:#]-X`$Z=S8
MZ,`'!W_)$>^+1-8T0SV90M3HVS44[`W6KK.WIWVU6QNT(&BK#8C9,K.9\JG@
M48*G#KMJLUEG"HFA@=G!7`.32XY;9@RRGA*S00U,3DTW4T@"N'`AV#=0?<6(
M>\9=P<L82ES/,Q30].,-J(R3U=22#G7U&5O">QF!E8.IP7XR`@V8\T@JT\#'
M)A1";`$[&DOK.NU1^=%T^4A6-B<F"!/W_'>2(5UZM(W\GY*>&,\#TI."E4E/
M0LQC2<^?/_2N07AV$N%))>//,X@PE`L!K+&Y<XMN4*_4[MY$SGZ7R@_R<#$/.4[N$G"WX
M:96<CY)S:RHY]PQ>P-\L%??:JL9+ID%("4)2GR7(E7'7!RMN%IU\/VU;R!&=
M[B*=9#1]89)UD;V3.8&<5S1Y>9?ZF,#;D>?#CNAC("*4AUW!9SW>(&%-P$9(
M`X$[+6V'6UL%MLEWZ+S!3CZIK=$PB?0BR#/&/ARPY^"LL3[^_N2!'*:V,R&_
M4[W/.FLV**&,;E&H^A=7U^;EQ8?KWOE;5G,M$1GD3L)D(NG0DTN$&SEZ6.BY
M1:$U'(+#1%9-@'3:8^4$J`;<],L]Z86N\9T5V6,3@OI:YC52XLVF]30:*G'+
MM%8;8JXHAH%(TY2!+%MWO*^!@O$U,"2@MNY/AIY1\`:-K"^8DG,#L@4T=98X
MBLHET3VHV!6A$$)Z($,G%+H?HD>20>A'ONV[:)5[_?[EQ?6%"5V5J$I%8N>G
MYO')2;=_G9'7<S\`Z?#\B,:2Z)<YHS"@=$8-W1LM.J.:GR4%)O6T*!>4\?JU
M:4D?%=Q%G(N,F=LMX]MF@HC3F=#>'0H*$O0Q42I#[O);"SWQ-/Q3GK#<GI7_
MJYS<@G?L#;)*J'NSSS3ME6*6QA(WF47ZR"G>'CJ>(\8<X^9H3-1*2G'3P@P:
M1IQ(7B1`/>9JI,*2H'JC?O=#W^:#Q"$GA>(8`JE(#W,4&0W%`=?>6R/'7M.#
ML8^HU7'<%F];=5RAZ(Y;$^G-3VZ4<--XR&E8&0O``W>.2&XL*0$('/*_SR@<
M&*FXC#)LKJO%KY)BP!OY+H]#;$73<HOA>`\8C*7VXJO,Q==9B\<R%BJY`R3`
M!RVNM`.30DM=`X!5L/QWF-@,YM(]A35W/,D')3"9Y<%=$+=)#<DUG\*6:(%;
MVNO#\KD#+I,ELO6-C_C!S?#RRK"5400<&$;%O14<WC\N4XNB!--K-6!/2',(
M]H(D5DK!'[_!$&*W94,1'EA<S=PEBVXDY@Z]WA)CE\300*=#CKW,%Y;1"4@W
MCRCG#-1I646(865;-\P:D562V1:I_1X78@T-Z1VR>N@,!J"#:)*4$90*K_(Y*%X@`'+F:?ZK
M3EI=+AIUA4?<60%V4:$[=I!I`FF%%28N<SV4RP5E2U\K++"R'A@E(5!BR920
MO0HM3TP50V)[CZ</I"&QQ5$H4KN3F!P'[$Q_S.\:C=BBDYYH/B8*@4A=S/S;
M'.2@%'*@(*4.DB2AN`63R"11.`1GZ>27[K4)[MC;"W#(%`PP`UPL*9K\5LI-
M+`.V!3O=\67_W>4;L]_O'V1W2,E.-+T>YP,!FUPF5+B!S6[2*>`YN[CHOP9*
M#@HMW>MWW<N#:N4W"A(3TT(F*C+'=SBQ7P'(/#[KGG_N$!3]0'_'OY5[,JE7
M`)20Z??EQWBW`&(GS+7FF-6$G5@:HXI:J3CCE1EXW0!AB1>YD\!2?'C(D)AW
M0$R';6W%:71HG5IV(Y8QU4D%D/$TZJRFX=T\&ILHK4:=Q=/+=EL`G'\MA=_`
M?8-])::X"TLITSJJ]56<K,CYS67MHQ%ZL5.K:;
M:4"4]E1+=*V\[SNR%11,"QGY#!R5*50')#+['?EQ#O04OF*@9X<^6*A!:CQ)&2<JEQA",L556%'RK!>YE&N2GX;3$7HC1DW=:T(?JF0;NA=,4
MEC]$2>*`9:&]C$KCF#3)D,$N%#K@(PP@!DV7-MV;KJXO4`/14Z4LN.=$ICP-
MK4G/*,:(+8[E.O^0SJ(_$0G&^!2C@3^(RX>)"Y@%"(;*`H(Y/35[Y]WK7'OH
M^*$3S7$MH!WVV<N>>=J[O+HN#@2N)-/@NG&DG$PR.2@IT@7N82<+LHBR%.`!
MTC*#96G3POB$.&]HAGSD"*HJ@1ZU%_'DY)J6M,<C%-C8)/;),Q*L^)D%Y2R\
MF?,<YV"4F;=\G%*0#*D+-+U,[$LL24%C[O_M:HD6U?^H.JM'&>.!^K_]O1VL
M_]G!\M_]O=V=)\W6[MY>:U7_\R,>V!J0U2#)#9M._+'>A\TBQT5[$%'9W:+8
M"SW=I_'Y9^K=8A`^\,'/QR2(JA1JL+]P<)PG[FPP@L``T\X<WML11/D-PO$>
M5!."1]C'G2#`$SQTHZ?SV&W'N*'G#?V^,R)XZO.Q6+.#90MX*`^.:[O9W(:M
MZVGUJ5:9(>9B"_U8T1@?9=Y'`\<OOG.=F]S+F0?68E"`!#,TRKWD8>@54,+P
MPE<U(7H#%K_DA[+"P-IR/`6++4-5Y?+AJFN^OGH#KUA2O*+>90)U"*@PZT31
M2>@'B7,K:%UD`0PBT<G``65!3XX^U6"J^AVD2,_O4DQ,2TO(RZL,9!0XF^)!
M,8.=!(4)O,(<U#H&?48'1T"XJ>5XU`&\`KNN$A/P^?;7S\;3ZF]/R=AF@X(!
M%K/]VM[=^ZSG'/K@G(-4HRQ9K(^99W34J.X-22ZB";E]B[1(3!(B*9AAZTZ`
MRZD']/#2H+%SP.BK4FHEWX$:C!KU*7JS@6%D$:'LH"\-W@<3H;VXD4*]+`V>
M27'@=&XN;@1%O\TT`TI8-#/"T:C!1!(Q?Y2A5!LZIIA<+IB>B6WDQZ7OL5CB
MD+6T-^M!%)KR]0OXI5I4.^RLR'KVBFU#_/FT6AG2MH^C@S"'>#PNK!$_8'@N
M$?*I'W&(.:;S7I].)TA4FI^1L`K_`HYQ*Z;Q'D5,"<=;C/J95,Y$'.@H49^%
M;*\I/ZK.KBY.?C$OCS_6LWD@`VAM+J#UQ)^Y`TSZ@D)Z++3N%-)GZC0%^E1@
M60'8#VMD1(P'2!?RK)>]>W,)9)V<`699K>FI,L3<G&K0`5\"6#HY;09]_&P"
M-D1&]("C)?E3CQD/G_59VJXO>(J,"%X\<R18H5>T:I-7^LJ^:@U2*4'Q:P@0
MY*$U=5ST98^5LYMKEQ_,.'V"J57\7",Q:7TV,K*GM&4A?#L/+T^-29_C(V,P
M'C&0:H[M2@E$PM131]9_J@A:U0W%QS.*E61/-H\PV^.B5[[;*33<DN._4VR(
M?*&K9=H@RX=^+ND"7G@F#T+FV@@A9JP916BL`"H=((I<5/_VS\6F@*C5=:D(
M`_M'.5ZP4="0-7!:\T!@;)F1@_RB4YBL+SSF@I.2+851F7'`B>*N4FA),K53
M"D7YV$.JZUP`,)'32G;(G78]O](JZX&]2L3%LUP7?"LZ$]'RD3'9FC;B"0);
MN\+M'P)>=5#2:#0H=DH-'V**?-U"*+'^>0<$M\[RQA_(>T&)HE2)RW>)I>;Q
MDW=J.7A2+++T/60>DX`Q9Q\+\_YH.70J)`_F`G=>G#GJ)SJ@^MQ3G05M73A_
M$$%I,%]D-LSR"4MZU'3!T8[D=/$013+OH3F76=V"B:SHBI!W5N)9Y82RQ$6)
M(9=Y*2H#]B)Q(V"1]'P=H=Y@/QMU"5])1"0=3BJFD17PHO!B_MPC'M*%!!@0
MO-OGXH!V?#+27N1;M822!&$!59R-/,#6["Y4FG14DVBU%Z.,4U3?B++]<V[:
M)?Q-&S6!OU?.^(DR'ILC[O%0'GU1[#B@EY
M%DV1E11""/\01LB38L>[M5S8`6H.;S`^#:*Y(>UC/*HRE*!.A.,48T3N^;/1
MF/78"'28ZC`>(S2(O?ZDT?5!<Z"S7"#Z`:)1BW>*&!T[TKYL;AIR(;$CYNP)
M]\9&1QI4$!KF\2\1D]E;RE1#.!32;9CD'$%95_HA1Z-!CXXPW8NE"_CM!=C]
M4W@4_]1P&J!&MN+J?\G)W'_O^#^?_XGO2`Q-)WBL2\#?=/^[A?=_=[>W]U;W
M?W_$LY3_CW0)^,'[O\WM^/Y?N[V#^;_])HC!*O_W`Y[O<?\WD:%'N@'\W>[Z
M_M^_WOO@LU3_4T;^4P<!#^7_=_?W$_O?VB?]WVVN\O\_Y%E^_Q=_@Q,X$[SL
M;B\VR7=TJV!=BSH%YN0AP$C*:.J(@#J1WS2T;%5Q$[^.2ZK`1ZQ2":1V:[C.
M3L%Z^'="71\NW"!FJRO$CW.%.%T9&A$+XESAL[?],P@4GGWK!>/D6.0;KA[3
MR4.E@AD-//+I:^4XY?>+$U@L+%X,O/A*\[_1O>,'+PF_[N+9_/FUV>O7**K%
M&[NU?&$296&,7YN?Z\N:6\N;V\N;MS]K5/6NKUI[YF7W+^`@=!5AM1I]8*]>
M0;S/?F?R&\0[$.2J*\2J`H;D/"GKQ>*X,;@(9'6HO%.>SU,581S,:M6Y)?=(
MO>'8EQ=8>6-T4+0\;(U'XR;F"1(+Q=9:[?U&$_ZTUF1!3%SBF;\_/`C]`+9$
M\&HD%CF0=B?W+CYU\QG")A81;0JF)F)Z-F_F$0<+!`);>^V,-E$L+,\H*SS6
M1\::F+5/7_:'G[XTF^I?"ZE0"P&&$Z_44!=,:_RZW<:*N#PN[LVIVJ93O<_V
M%6(LIY28=C1HQ35<4!^MA/UF#FNTN$:ZLK!CHU&()
M2]2ARP*V4#[J0=8L@,JSAW*-7\VBDLKU2I)\E%7KP9@X%HPS%;'X+F:,R[T1
M9K$$>SZ02<)@3Y9X#U.JFH/\<JGOE+KAN)>4&1WRFUR&[`>[_F@$?_%
ML:K)J7RLQ'6\Y:CT>8.U#!U$:V@;6<!MXW\F/"6R0W=^BD8.)RMOD,#VJO[_
MBN5W'99==?B:FPY?=='AZX4EN?:$OD"YH%1R2<69-(1+Y:TH6I4HERE/;B\Q
MO9R_%LM9<AN^(DLSY,T?VBHL;RYO@*JTHHC].S#6#OT'!HDC1+6>)*_/@(IR
M?E,K#%O>3.._7G8'+!Z!*%]TZ6N)I9*6,Y*G6U21G-.H^#0+%DJ,&\E>9$BD
M,U4%FG,K='R=1`65WB2:B!?*-&T$9>SU#S1U9'U`?O!\QHZ#P,7_I0&\B0.9
MHH]54'>R4J,`FDB$U7&';,375$M4L5JR*O=57;^H$C4)KJF2L5):BXHB0%6-
MSV198[6B#I!?``WQX7%\&B/&9!QPPPKFM9C(.EN#CVO4HJ^U]"+0>VCMK2FA
MP-SV]";Y?YVHM!3#0!%P6X8D*!GH7<FRT\."I>AHS1ZEPTMJ6"5(,-3J47%T
M](_3,#`=:EEU*H+DBTFQ$ZU5IH0T\[]MJ$K2!2S(U9)6RLI$U2"`6(8_)O*M
MEF4LM*M&.I,KC`KM_^KP?_6LGM6S>E;/ZED]JV?UK)[5LWI6S^I9/:MG]:R>
AU;-Z5L]_MP<')`````""_K]N1Z`"``#,!=C(SDX`>```
`
end


> Happy Hacking !

