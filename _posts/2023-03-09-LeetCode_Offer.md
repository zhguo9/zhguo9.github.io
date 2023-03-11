---
title: LeetCode_Offer
typora-root-url: ./
tags: 
---

{:toc}

## 28 easy recur

对称二叉树的特点：

- L.val = R.val
- L.left.val = R.right.val
- L.right.val = R.left.val



recur from top to bottom. judge whether every pair is symmetric.

```c
/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     struct TreeNode *left;
 *     struct TreeNode *right;
 * };
 */

bool recur(struct TreeNode* L, struct TreeNode* R)
{
	// every pair from top to bottom is symmetric
    if (L == NULL && R == NULL)
    {
        return true;
    }
    // not symmetric
    else if (L == NULL || R == NULL || L -> val != R -> val)
    {
        return false;
    }

	// continue to recur to bottom
    return recur(L -> right, R -> left) && recur(L -> left, R -> right);
}

bool isSymmetric(struct TreeNode* root){
    if (root == NULL)
    {
        return true;
    }
    else
    {
        return recur(root -> left, root -> right);
    }
}
```



## 29 顺时针打印矩阵

```c
int* spiralOrder(int** matrix, int matrixSize, int* matrixColSize, int* returnSize) {
    if (matrixSize == 0) {
        *returnSize = 0;
        return NULL;
    }
    *returnSize = matrixSize * (*matrixColSize);
    int *res = (int*)calloc(*returnSize, sizeof(int));
    int up = 0, down = matrixSize - 1;
    int left = 0, right = matrixColSize[0] - 1;
    int index = 0;
    while (index < *returnSize) {
        for (int i = left; index < *returnSize && i <= right; i++) {
            res[index++] = matrix[up][i];
        }
        up++;
        for (int i = up; index < *returnSize && i <= down; i++) {
            res[index++] = matrix[i][right];
        }
        right--;
        for (int i = right; index < *returnSize && i >= left; i--) {
            res[index++] = matrix[down][i];
        }
        down--;
        for (int i = down; index < *returnSize && i >= up; i--) {
            res[index++] = matrix[i][left];
        }
        left++;
    }
    return res;
}
```




> Happy Hacking !

