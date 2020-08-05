const argon2 = require('argon2')
const { client, q } = require('../DBConnector.js')

const usernameSchema = {
    body: {
        type: 'object',
        required: ['username'],
        properties: {
            username: { type: 'string' },
        },
    },
}
const registerSchema = {
    body: {
        type: 'object',
        required: ['username', 'password1', 'password2'],
        properties: {
            username: { type: 'string' },
            password1: { type: 'string' },
            password2: { type: 'string' },
        },
    },
}

module.exports = fastify => {
    fastify.post(
        '/check-username',
        { usernameSchema },
        async (request, reply) => {
            try {
                return {
                    available: await checkUsernameAvailable(
                        request.body.username
                    ),
                }
            } catch (err) {
                reply.code(500)
                return err
            }
        }
    )
    fastify.post('/register', { schema: registerSchema }, registerNewAccount)
}

const checkUsernameAvailable = async username => {
    try {
        await client.query(
            q.Get(q.Match(q.Index('users_by_username'), username))
        )

        return false
    } catch (err) {
        if (
            err.requestResult.responseContent.errors.code !==
            'instance not found'
        ) {
            return true
        }
        throw err
    }
}

const registerNewAccount = async (request, reply) => {
    const { username, password1, password2 } = request.body

    // First check password match
    if (!!password1.localeCompare(password2)) {
        return {
            complete: false,
            message: 'Passwords do not match',
        }
    }

    // Check if username exists
    try {
        if (!(await checkUsernameAvailable(username))) {
            return {
                complete: false,
                message: 'Username not available',
            }
        }
    } catch (err) {
        reply.code(500)
        return {
            complete: false,
            error: err,
        }
    }

    const hash = await argon2.hash(password1)

    try {
        await client.query(
            q.Create(q.Collection('users'), {
                data: {
                    username,
                    passwordHash: hash,
                },
            })
        )

        // TODO return token
    } catch (err) {
        reply.code(500)
        return {
            complete: false,
            message: 'Could not create user',
            other: err,
        }
    }

    return {
        complete: true,
    }
}
