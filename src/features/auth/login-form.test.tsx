import '@/test/next-navigation';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/mocks/db';
import { router, setLocation } from '@/test/next-navigation';
import { renderWithQuery } from '@/test/render';
import { LoginForm } from './login-form';

beforeEach(() => {
  resetDb();
  router.replace.mockClear();
});

describe('LoginForm', () => {
  it('형식 오류 문구를 보여 준다', async () => {
    setLocation('/login');
    renderWithQuery(<LoginForm />);
    await userEvent.type(screen.getByLabelText('이메일'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('비밀번호'), '123');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('이메일 형식이 아닙니다.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호는 8자 이상입니다.')).toBeInTheDocument();
  });

  it('서버 오류(401)를 보여 준다', async () => {
    setLocation('/login');
    renderWithQuery(<LoginForm />);
    await userEvent.type(screen.getByLabelText('이메일'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('맞지 않습니다');
  });

  it('로그인하면 redirect 경로로 이동한다', async () => {
    setLocation('/login?redirect=%2Fstudio%3Ftab%3Dworkflows');
    renderWithQuery(<LoginForm />);
    await userEvent.type(screen.getByLabelText('이메일'), 'demo@moa.dev');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password1');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/studio?tab=workflows'));
  });
});
