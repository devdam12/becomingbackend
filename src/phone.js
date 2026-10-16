/* Shared structural international validation; this does not verify number ownership. */
(function(root){
  const normalizePhone=value=>String(value).replace(/[ ()-]/g,'');
  const validPhone=value=>/^\+[1-9][0-9 ()-]*$/.test(String(value)) && /^\+[1-9]\d{7,14}$/.test(normalizePhone(value)) && !/^\+(\d)\1+$/.test(normalizePhone(value));
  const api={normalizePhone,validPhone};
  if(typeof module!=='undefined' && module.exports)module.exports=api;else root.ConferencePhone=api;
})(typeof globalThis!=='undefined'?globalThis:this);
