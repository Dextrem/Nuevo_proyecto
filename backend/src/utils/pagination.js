const MAX_LIMIT = 200;

export const parsePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const parsedLimit = parseInt(query.limit);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parsedLimit || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildPaginationResponse = async (prismaQuery, prismaCount, { page, limit, skip }) => {
  const [data, total] = await Promise.all([
    prismaQuery(skip, limit),
    prismaCount(),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

export const paginatedFind = async (prisma, model, options = {}) => {
  const { 
    where = {}, 
    include = {}, 
    orderBy = { createdAt: 'desc' },
    page = 1, 
    limit = 20 
  } = options;

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma[model].findMany({
      where,
      include,
      orderBy,
      skip,
      take: limit
    }),
    prisma[model].count({ where })
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  };
};
