import json
import urllib.error
import urllib.request

BASE_URL = 'http://127.0.0.1:8000/api'


def post(path: str, payload: dict):
    data = json.dumps(payload).encode()
    request = urllib.request.Request(
        f'{BASE_URL}{path}',
        data=data,
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


if __name__ == '__main__':
    register_status, register_body = post(
        '/auth/register',
        {
            'name': 'Teste',
            'email': 'teste@example.com',
            'password': 'Aa123456',
            'phone': '11999999999',
            'gender': 'male',
            'cpf': '11144477735',
        },
    )
    print('REGISTER', register_status, register_body)

    login_status, login_body = post(
        '/auth/login',
        {
            'email': 'teste@example.com',
            'password': 'Aa123456',
        },
    )
    print('LOGIN', login_status, login_body)
