// Demo sign-in. This is a simple gate for a live demo, not real security.
// Only a SHA-256 hash of the password is stored here, so the password isn't readable in the repo.
// To change the password, put the new hash below:
//   node -e "console.log(require('crypto').createHash('sha256').update('NEW PASSWORD').digest('hex'))"
window.DEMO_LOGIN = {
  username: 'Nttdata',
  passwordSha256: '84ad920c17bd4ab5924cc5c79bea905ab25004b775d1615b14faaa4e25a4d4cd',
  displayName: 'Deepan', // shown in the profile menu after sign-in
};
