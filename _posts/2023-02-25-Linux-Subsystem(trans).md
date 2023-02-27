---
title: Linux-Subsystem-Scheduling
typora-root-url: ./
tags: translate subsystem
---

> Copied from Kernelnewbies. Thank for this!

There is the need for processes on a system to occasionally request services from the kernel. Some older operating systems had a *rendezvous* style of providing these services - the process would request a service and wait at a particular point, until a kernel task came along and serviced the request on behalf of the process.

UNIX works very differently. **Rather than having kernel tasks service the requests of a process, the process itself enters *kernel space*.** This means that rather than the process waiting "outside" the kernel, it enters the kernel itself (i.e. the process will start executing kernel code for itself).

This might sound like a recipe for disaster, but **the ability of a process to enter kernel space is strictly controlled** (requiring hardware support). For example, on x86, a process enters kernel space by means of system calls - well known points that a process must invoke in order to enter the kernel.

**When a process invokes a system call, the hardware is switched to the kernel settings** (for example, on x86, amongst other things, the protection level is set to ring 0 instead of ring 3). At this point, the process will be executing code from the kernel image. It has full powers to wreak havoc at this point, unlike when it was in user space. Furthermore, the process is no longer *pre-emptible*.



## Pre-emptibility

**Processes in user space are *pre-emptible*** - what this means is that a process may have the CPU taken away from it arbitrarily. This is how pre-emptive multitasking works: the scheduling routine will periodically suspend the currently executing process, and possibly schedule another task to run on that CPU. This means that theoretically, a process can be in a situation where it never gets the CPU back. In reality the scheduling code has an interest in fairness and will try to give the CPU to each process with a weak level of fairness, but there are no guarantees.

In contrast, **every task (all schedulable objects are referred to as "tasks" for clarity) running in kernel space *cannot* be pre-empted.** This means that the CPU will never be scheduled away from the task. This fact is complicated by two aspects :

### Interrupts

Unless interrupts have been disabled (and some interrupts cannot be disabled), **an interrupt can occur which will temporarily interrupt the running task.** **This can happen to both user-space and kernel-space tasks.** The difference here is that, **for kernel-space tasks, the interrupt is guaranteed to return the CPU back to the task sooner or later.** **For user-space tasks, the interrupt could cause another task to be scheduled on that CPU, and execution of other tasks might well happen - here the user-space task must be chosen again by the scheduler.** Of course this explanation is not the entire story (as usual) - firstly, there are kernel-space subsystems that can register code to be run on the way back from an interrupt, such as bottom halves and tasklets. This does not changes the fact, however, that the scheduler will not be involved in the interruption of a kernel-space task. Secondly, interrupts can interrupt interrupts - a salient example is the ARM architecture, where fast interrupts (FIQs) have a higher hardware priority than normal interrupts (IRQs). So in fact return from an FIQ can return to another interrupt handler. **Sooner or later though, the original interrupt will complete and return the CPU to a kernel-space task.**

### Co-operative multi-tasking

We have already said that a task in kernel space cannot have the CPU scheduled away from it. However, it can choose to `schedule()` on purpose (and for latency reasons all good system calls do this often). Note that the phrase "on purpose" is slightly misleading - what is actually meant is that **a task in kernel space will purposefully include code that *might* cause a scheduling to happen.** For example a task can set a `SCHED_YIELD` policy, then specifically call to the scheduling routine to voluntarily give up a CPU. **But** it can also cause an schedule() to happen by using routines that may sleep. A common example here is `kmalloc()`, which can sleep when called with a `GFP_KERNEL` priority. The difference here though is that the **kernel space code "knows" that this could cause a schedule to happen, so it has the opportunity to keep the CPU if it wants. A user space task has no choice in the matter.** A consequence of these rules is described in the section "Locks and Scheduling" below.

## User context and kernel threads

**Remember, to the scheduler and the kernel at large, every schedulable object (i.e. anything that can be chosen by the `schedule()` routine) is known as a task.** No distinction is made between any of these objects, so what are often called processes, LWPs, kernel threads, fibers, threads, etc. are **all** just tasks to the kernel, each of them with their own particular characteristics. This is a big win in terms of kernel cleanliness - there is no real reason to separate the cases out, so why bother ?

These characteristics are particularly interesting though. For example some tasks may have user space memory mappings and stack - a typical example being a user space process. **The term *process context* is used to refer to one of these tasks executing in kernel space - they have both user space mappings, and the (possibly temporary) kernel mappings and stack.** In this context copying to and from user memory makes sense.

**Once again, what are sometimes known as "kernel threads" or "fibers" are not treated differently from other tasks.** They may have user-space memory mappings just like "normal" processes. **The only distinguishing feature here is that the code executed by the kernel thread comes from the kernel or module image, rather than from binary process images.**

**The term *interrupt context* is often used to mean code currently executing as a result of a hardware interrupt.** This encompasses bottom halves, ISRs, softirqs, and tasklets. Here there is no associated task as such so it is meaningless to schedule (and in fact a panicking bug). This also means that you cannot sleep here, as this implies a schedule.

## Scheduling algorithm

The scheduler has a problem - there is a direct contradiction between latency/fairness (allowing each task to run as soon as possible) and the cost of a context switch (the operations necessary for changing from one task to another). Too much time given to each task means that processes will have to wait longer for the CPU - this is not good if one of the processes is trying to provide interactive facilities, for example. Switch too often and too much time is taken up with the switching, leaving less CPU for actually doing something useful. Each pre-emptible task is allocated a timeslice - a smallish period of time which it is allowed to run for. **The timer interrupt is invoked periodically and it will decide if the task should be pre-empted in favour of another task on the runqueue (the runqueue is a queue of all tasks that are ready to run).** Additionally, scheduling can happen when requested by kernel code, and also after system calls are finished, on the return path from the kernel system call code to user-space. More detail can be found [here](http://www.ora.com/catalog/linuxkernel/chapter/ch10.html).

### Some code

FIX ME

## Locking and Scheduling

We have already mentioned that kernel tasks cannot be pre-empted unless they choose to allow it, at well-known points (such as a `kmalloc()` call of priority `GFP_KERNEL`). But on SMP systems, this still means that several tasks can be running in kernel space at the same time (additionaly protection is also needed against interrupts, even on UP systems). An obvious consequence is that tasks will need to be "synchronised", i.e. shared resources must be given exclusively to a task altering those resources. A lack of proper synchronisation of shared resources is known as a "race condition" - named from the notion that one task can "race" with another to access the resource. This is fairly obviously a bad thing. One of the synchronisation mechanisms is the *spinlock*. This is simply a data structure which is acquired atomically, and can only be held by one task at a time. The spinlock is held over the critical region (the code section that modifies the shared resource from one "known state" to another). If a task tries to acquire an already held spinlock (with `spin_lock(&lock)` or similar function) it will "spin", i.e. execute a tight loop until the spinlock is released.

This is why it is a bad idea (read: illegal) to call a function that might sleep whilst you hold a spinlock: you will hand on the CPU to another task that might try to acquire the same spinlock. This can easily lead to deadlock where you have task A waiting for a spinlock so it can release a resource needed by task B, which currently holds the spinlock task A wants. (Additionally scheduling with a spinlock held means that broken pointers can be followed when manipulating the run queue).

But, I hear you ask, surely it is often necessary to sleep whilst still maintaining mutual exclusion on some data structure ? And indeed, it is. The method generally used here is the *semaphore*. There are several strains of different locking primitives as well, such as `atomic_t` types. Read the kernel-locking document in Documentation/Doc``Book/ in the kernel source tree for more info on these. One minor thing to note is that the big kernel lock (BKL), used by `lock_kernel()` and `unlock_kernel()`, is *not* a normal spinlock. You can sleep with the BKL held, and it will be freed when you schedule.



------



## Glossary



Pre-emptible

- A task is pre-emptible if the CPU can be scheduled away from the process. This is different to interrupts, where the interrupt temporarily uses the CPU.

kernel space

- Executing code that comes from the kernel image or a module image. The code has full permissions to do whatever it wants (on x86, the code is in ring 0). This may be a task or an invoked interrupt. If it is a task, it is not pre-emptible. Access to user-space memory usually requires the data to be copied.

user space

- Executing code that comes from a normal process image. This is run in ring 3 on x86 and has limited rights. It is protected from affecting other process's or the kernel's address space and does not have direct access to the hardware (unless given it by the kernel explicitly).

process context

- Executing kernel code on behalf of a process. The code may schedule (by sleeping, or explicitly) but is still not pre-emptible.


> Happy Hacking !

