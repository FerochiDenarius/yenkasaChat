function invalid(message, fields = []) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.fields = fields;
  return error;
}

function validateAuthBody(kind) {
  return (req, res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const errors = [];

    if (kind === 'login') {
      if (typeof body.identifier !== 'string' || body.identifier.trim().length < 3) errors.push('identifier');
      if (typeof body.password !== 'string' || body.password.length < 1) errors.push('password');
    }

    if (kind === 'register') {
      if (typeof body.username !== 'string' || !/^[a-z0-9_.-]{3,40}$/i.test(body.username.trim()))
        errors.push('username');
      if (typeof body.location !== 'string' || body.location.trim().length < 2) errors.push('location');
      if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)
        errors.push('password');
      if (body.email != null && (typeof body.email !== 'string' || body.email.length > 254)) errors.push('email');
      if (body.phoneNumber != null && (typeof body.phoneNumber !== 'string' || body.phoneNumber.length > 32))
        errors.push('phoneNumber');
    }

    if (errors.length) return next(invalid('Request validation failed', errors));
    return next();
  };
}

module.exports = { validateAuthBody };
