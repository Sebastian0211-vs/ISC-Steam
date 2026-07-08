import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';

// Students unlock the publisher role with the class code (server/.env).
const PUBLISHER_CODE = process.env.PUBLISHER_CODE ?? 'ISC';

export async function register(req, res, next) {
  try {
    const { username, email, password, displayName, publisherCode } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const clash = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
    if (clash) return res.status(409).json({ error: 'Username or email already taken' });

    // Bootstrap: the very first account becomes admin.
    const isFirst = (await User.estimatedDocumentCount()) === 0;
    const role = isFirst ? 'admin' : publisherCode === PUBLISHER_CODE && publisherCode ? 'student' : 'visitor';

    const user = await User.create({
      username,
      email,
      displayName,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    });

    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      $or: [{ username: username?.toLowerCase() }, { email: username?.toLowerCase() }],
    });
    if (!user || !(await bcrypt.compare(password ?? '', user.passwordHash))) {
      return res.status(401).json({ error: 'Wrong username or password' });
    }
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ user: req.user.toPublic() });
}
