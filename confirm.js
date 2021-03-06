// == BSD2 LICENSE ==
// Copyright (c) 2014, Tidepool Project
//
// This program is free software; you can redistribute it and/or modify it under
// the terms of the associated License, which is identical to the BSD 2-Clause
// License as published by the Open Source Initiative at opensource.org.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the License for more details.
//
// You should have received a copy of the License along with this program; if
// not, you can obtain one from Tidepool Project at tidepool.org.
// == BSD2 LICENSE ==

'use strict';

const _ = require('lodash');

module.exports = function (common, deps) {

  const superagent = _.clone(deps.superagent);

  return {
    /**
     * Start signup, send an e-mail to the new user
     *
     * @param {string} invitedId - id of the user that signup if for
     * @param {string} lang - The language for the e-mail
     * @param {(err: object) => void} cb callback
     */
    signupStart: (invitedId, lang = 'en', cb = _.noop) => {
      if (_.isEmpty(invitedId) || !_.isString(invitedId)) {
        throw new Error('Invalid parameter invitedId');
      }
      /** @type {string} */
      const url = common.makeAPIUrl(`/confirm/send/signup/${invitedId}`);
      fetch(url, {
        method: 'POST',
        headers: {
          'x-tidepool-session-token': common.getToken(),
          'x-tidepool-trace-session': common.getSessionTrace(),
          'x-tidepool-language': lang,
        },
        cache: 'no-cache',
      }).then((response) => {
        if (response.ok) {
          return cb(null);
        }
        cb(new Error(`Invalid HTTP response ${response.status}`));
      }).catch((reason) => {
        cb(reason);
      });
    },
    /**
     * Confirm a signup
     *
     * @param {String} signupId - id of the signup confirmation
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    signupConfirm: function (signupId, cb) {
      common.assertArgumentsSize(arguments, 2);
      superagent
       .put(common.makeAPIUrl('/confirm/accept/signup/'+signupId))
       .end(function (err, res) {
        if (err != null) {
          // TODO: update version of lodash so we can use _.get
          err.message = (err.response && err.response.body && err.response.body.reason) || '';
          return cb(err);
        }
        if (res.status !== 200) {
          return cb({status:res.status,message:res.body.reason});
        }
        return cb();
      });
    },
    /**
     * Verify a custodial signup with birthday and password
     *
     * @param {String} signupId - id of the signup confirmation
     * @param {String} birthday - birthday of the signup
     * @param {String} password - password of the signup
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    custodialSignupConfirm: function (signupId, birthday, password, cb) {
      common.assertArgumentsSize(arguments, 4);
      superagent
       .put(common.makeAPIUrl('/confirm/accept/signup/'+signupId))
       .send({birthday: birthday, password: password})
       .end(function (err, res) {
        if (err != null) {
          err.error = (err.response && err.response.body && err.response.body.error) || '';
          err.message = (err.response && err.response.body && err.response.body.reason) || '';
          return cb(err);
        }
        if (res.status !== 200) {
          return cb({status:res.status, error:res.body.error, message:res.body.reason});
        }
        return cb();
      });
    },
    /**
     * Resend an existing invite
     *
     * @param {string} email - email of the user requesting the password reset
     * @param {string} lang - The language for the e-mail
     * @param {(err: object) => void} cb callback
     */
    signupResend: function (email, lang = 'en', cb = _.noop) {
      if (_.isEmpty(email) || !_.isString(email)) {
        throw new Error('Invalid parameter email');
      }

      const url = common.makeAPIUrl(`/confirm/resend/signup/${email}`);

      fetch(url, {
        method: 'POST',
        headers: {
          'x-tidepool-trace-session': common.getSessionTrace(),
          'x-tidepool-language': lang,
        },
        cache: 'no-cache',
      }).then(async (response) => {
        if (response.ok) {
          return cb(null);
        }
        cb({ status: response.status, message: await response.text() });
      }).catch((reason) => {
        cb(reason);
      });
    },
    /**
     * Cancel an existing invite
     *
     * @param {String} inviterId - id of the user that send the invite
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    signupCancel: function (invitedId, cb) {
      common.assertArgumentsSize(arguments, 2);
      common.doPutWithToken(
        '/confirm/signup/'+invitedId,
        { 200: function(res){ return res.body; }, 404: [] },
        cb
      );
    },
    /**
     * Get the invites sent
     *
     * @param {String} inviterId - id of the user that send the invite
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    invitesSent: function (inviterId, cb) {
      common.assertArgumentsSize(arguments, 2);
      common.doGetWithToken(
        '/confirm/invite/'+inviterId,
        { 200: function(res){ return res.body; }, 404: [] },
        cb
      );
    },
    /**
     * Get the invites received
     *
     * @param {String} inviteeId - id of the user who was invited
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    invitesReceived: function (inviteeId,cb) {
      common.assertArgumentsSize(arguments, 2);

      superagent
        .get(common.makeAPIUrl('/confirm/invitations/'+inviteeId))
        .set(common.SESSION_TOKEN_HEADER, common.getToken())
        .end(
        function (err, res) {
          if (err != null) {
            if(err.status === 404) {
              return cb(null,[]);
            }
            return cb( (err.response && err.response.body) || [] );
          }
          if (res.status === 200) {
            return cb(null,res.body);
          } else if (res.status === 404){
            return cb(null,[]);
          } else {
            return cb(res.body,[]);
          }
        });
    },
    /**
     * Invite a user
     *
     * @param {String} email - email of the user to invite
     * @param {Object} permissions - permissions to be given
     * @param {String} inviterId - id of the user that send the invite
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    inviteUser: function (email, permissions, inviterId, cb) {
      common.assertArgumentsSize(arguments, 4);

      var details = { 'email':email,'permissions': permissions };

      common.doPostWithToken(
        '/confirm/send/invite/'+inviterId,
        details,
        cb
      );
    },
    /**
     * Accept the invite
     *
     * @param {String} inviteId
     * @param {String} inviteeId - id of the user who was invited
     * @param {String} inviterId - id of the user that send the invite
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    acceptInvite: function (inviteId, inviteeId ,inviterId, cb) {
      common.assertArgumentsSize(arguments, 4);

      common.doPutWithToken(
        '/confirm/accept/invite/'+ inviteeId +'/'+ inviterId,
        {'key':inviteId},
        cb
      );
    },
    /**
     * Dismiss the invite
     *
     * @param {String} inviteId
     * @param {String} inviteeId - id of the user who was invited
     * @param {String} inviterId - id of the user that send the invite
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    dismissInvite: function (inviteId, inviteeId ,inviterId, cb) {
      common.assertArgumentsSize(arguments, 4);

      common.doPutWithToken(
        '/confirm/dismiss/invite/'+ inviteeId +'/'+ inviterId,
        {'key':inviteId},
        { 200: null},
        cb
      );
    },
    /**
     * Remove the invite
     *
     * @param {String} email - email of the user to remove
     * @param {String} inviterId - id of the user that send the invite
     * @param cb
     * @returns {cb}  cb(err, response)
     */
    removeInvite: function (email, inviterId, cb) {
      common.assertArgumentsSize(arguments, 3);

      common.doPutWithToken(
        '/confirm/'+inviterId+'/invited/'+email,
        null,
        cb
      );
    },
    /**
     * Request a password reset
     *
     * @param {string} email - email of the user requesting the password reset
     * @param {boolean} info - set the info parameter
     * @param {string} lang - The language for the e-mail
     * @param {(err: object) => void} cb callback
     */
    requestPasswordReset: function (email, info = true, lang = 'en', cb = _.noop) {
      if (_.isEmpty(email) || !_.isString(email)) {
        throw new Error('Invalid parameter email');
      }

      const url = common.makeAPIUrl(`/confirm/send/forgot/${email}${info ? '?info=ok' : ''}`);

      fetch(url, {
        method: 'POST',
        headers: {
          'x-tidepool-trace-session': common.getSessionTrace(),
          'x-tidepool-language': lang,
        },
        cache: 'no-cache',
      }).then(async (response) => {
        if (response.ok) {
          return cb(null);
        }
        cb({ status: response.status, message: await response.text() });
      }).catch((reason) => {
        cb(reason);
      });
    },
    /**
     * Confirm a password reset request with a new password
     *
     * @param {Object} payload - object with `key`, `email`, `password`
     * @param cb
     * @returns {cb}  cb(err)
     */
    confirmPasswordReset: function (payload, cb) {
      common.assertArgumentsSize(arguments, 2);
      //fail fast
      if( _.isEmpty(payload.key) || _.isEmpty(payload.email) || _.isEmpty(payload.password) ){
        return cb({ status : common.STATUS_BAD_REQUEST, body:'payload requires object with `key`, `email`, `password`'});
      }

      superagent
       .put(common.makeAPIUrl('/confirm/accept/forgot'))
       .send(payload)
       .end(function (err, res) {
        if (err != null) {
          err.message = (err.response && err.response.error) || '';
          return cb(err);
        }
        if (res.status !== 200) {
          return cb({status:res.status,message:res.error});
        }
        return cb();
      });
    }
  };
};
