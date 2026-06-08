/**
 * @swagger
 * components:
 *   parameters:
 *     PageParam:
 *       name: page
 *       in: query
 *       description: Page number for pagination
 *       required: false
 *       schema:
 *         type: integer
 *         default: 1
 *     LimitParam:
 *       name: limit
 *       in: query
 *       description: Number of items per page
 *       required: false
 *       schema:
 *         type: integer
 *         default: 20
 *     SearchParam:
 *       name: search
 *       in: query
 *       description: Search term for filtering results
 *       required: false
 *       schema:
 *         type: string
 * 
 *   responses:
 *     PaginatedResponse:
 *       description: A successful paginated response
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: true
 *               data:
 *                 type: array
 *                 items:
 *                   type: object
 *               pagination:
 *                 type: object
 *                 properties:
 *                   page:
 *                     type: integer
 *                   limit:
 *                     type: integer
 *                   total:
 *                     type: integer
 *                   totalPages:
 *                     type: integer
 *                   hasNext:
 *                     type: boolean
 *                   hasPrev:
 *                     type: boolean
 */
