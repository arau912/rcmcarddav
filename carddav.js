/*
 * RCMCardDAV - CardDAV plugin for Roundcube webmail
 *
 * Copyright (C) 2011-2021 Benjamin Schieder <rcmcarddav@wegwerf.anderdonau.de>,
 *                         Michael Stilkerich <ms@mike2k.de>
 *
 * This file is part of RCMCardDAV.
 *
 * RCMCardDAV is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * RCMCardDAV is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with RCMCardDAV. If not, see <https://www.gnu.org/licenses/>.
 */

/* global $, rcmail, rcube_webmail, rcube_treelist_widget, location, parent */

function getQueryParams () {
  // example: ?_task=settings&_action=plugin.carddav&abookid=6
  const params = {}
  for (const comp of location.search.split(/[?&]/)) {
    // because we split also on ?, first string is typically empty
    if (comp.includes('=')) {
      const parts = comp.split('=')
      params[parts[0]] = decodeURIComponent(parts[1])
    }
  }

  return params
}

window.rcmail && rcmail.addEventListener('init', function (evt) {
  if (rcmail.env.task === 'settings') {
    if (rcmail.gui_objects.addressbookslist) {
      // eslint-disable-next-line new-cap
      rcmail.addressbooks_list = new rcube_treelist_widget(rcmail.gui_objects.addressbookslist, {
        selectable: true,
        tabexit: false,
        parent_focus: true,
        id_prefix: 'rcmli'
      })
      rcmail.addressbooks_list.addEventListener('select', function (node) { rcmail.carddav_AbListSelect(node) })
    }
  }

  if (rcmail.env.action === 'plugin.carddav') {
    rcmail.register_command(
      'plugin.carddav-AbToggleActive',
      function (props) { rcmail.carddav_AbToggleActive(props.abookid, props.state) },
      true
    )
    rcmail.register_command(
      'plugin.carddav-AccAdd',
      function () { rcmail.carddav_AccAdd() },
      true
    )
    rcmail.register_command(
      'plugin.carddav-AccRm',
      function () { rcmail.carddav_AccRm() },
      false
    )
    rcmail.register_command(
      'plugin.carddav-AbSync',
      function () { rcmail.carddav_AbSync('AbSync') },
      false
    )
    rcmail.register_command(
      'plugin.carddav-AbClrCache',
      function () { rcmail.carddav_AbSync('AbClrCache') },
      false
    )

    const qparams = getQueryParams()
    if (qparams.abookid !== undefined) {
      rcmail.addressbooks_list.select('_abook' + qparams.abookid)
    } else if (qparams.accountid !== undefined) {
      rcmail.addressbooks_list.select('_acc' + qparams.accountid)
    }
  } else if (rcmail.env.action === 'plugin.carddav.AbDetails') {
    rcmail.register_command(
      'plugin.carddav-AbSave',
      function () { rcmail.carddav_AbSave() },
      true // enable
    )
  } else if (rcmail.env.action === 'plugin.carddav.AccDetails') {
    rcmail.register_command(
      'plugin.carddav-AccSave',
      function () { rcmail.carddav_AccSave() },
      true // enable
    )
  }
})

// handler when a row (account/addressbook) of the list is selected
rcube_webmail.prototype.carddav_AbListSelect = function (node) {
  const id = node.id
  let url

  this.enable_command('plugin.carddav-AccRm', false)
  this.enable_command('plugin.carddav-AbSync', false)
  this.enable_command('plugin.carddav-AbClrCache', false)

  if (id.startsWith('_acc')) {
    // Account
    url = '&_action=plugin.carddav.AccDetails&accountid=' + id.substr(4)
    this.enable_command('plugin.carddav-AccRm', !node.classes.includes('preset'))
  } else if (id.startsWith('_abook')) {
    // Addressbook
    url = '&_action=plugin.carddav.AbDetails&abookid=' + id.substr(6)
    this.enable_command('plugin.carddav-AbSync', true)
    this.enable_command('plugin.carddav-AbClrCache', true)
  } else {
    // unexpected id
    return
  }

  const win = this.get_frame_window(this.env.contentframe)
  if (win) {
    this.env.frame_lock = this.set_busy(true, 'loading')
    win.location.href = this.env.comm_path + '&_framed=1' + url
  }
}

rcube_webmail.prototype.carddav_AbToggleActive = function (abookid, active) {
  if (abookid) {
    const prefix = active ? '' : 'de'
    const lock = this.display_message(rcmail.get_label('carddav.' + prefix + 'activatingabook'), 'loading')

    this.http_post('plugin.carddav.AbToggleActive', { abookid, state: (active ? 1 : 0) }, lock)
  }
}

// resets state of addressbook active checkbox (e.g. on error)
rcube_webmail.prototype.carddav_AbResetActive = function (abook, state) {
  const row = rcmail.addressbooks_list.get_item(abook, true)
  if (row) {
    $('input[name="_active[]"]', row).first().prop('checked', state)
  }
}

// reloads the page
// if target is set to 'iframe', the content frame is reloaded, otherwise the entire page is reloaded
rcube_webmail.prototype.carddav_Redirect = function (target) {
  if (target === 'iframe') {
    const win = this.get_frame_window(this.env.contentframe)
    if (win) {
      win.location.reload()
    }
  } else {
    (this.is_framed() ? parent : window).location.reload()
  }
}

rcube_webmail.prototype.carddav_AbSave = function () {
  $('form[name="addressbookdetails"]').submit()
}

rcube_webmail.prototype.carddav_AccSave = function () {
  $('form[name="accountdetails"]').submit()
}

// this is called when the Add Account button is clicked
rcube_webmail.prototype.carddav_AccAdd = function () {
  const win = this.get_frame_window(this.env.contentframe)
  if (win) {
    this.env.frame_lock = this.set_busy(true, 'loading')
    win.location.href = this.env.comm_path + '&_framed=1&_action=plugin.carddav.AccDetails&accountid=new'
  }
}

// this is called when the Delete Account button is clicked
rcube_webmail.prototype.carddav_AccRm = function () {
  const selectedNode = rcmail.addressbooks_list.get_selection()
  if (selectedNode.startsWith('_acc')) {
    const win = this.get_frame_window(this.env.contentframe)
    if (win) {
      this.env.frame_lock = this.set_busy(true, 'loading')
      win.location.href = this.env.comm_path +
        '&_framed=1&_action=plugin.carddav.AccRm&accountid=' + selectedNode.substr(4)
    }
  }
}

// this is called when the Resync addressbook button is hit
// synctype: AbSync, AbClrCache
rcube_webmail.prototype.carddav_AbSync = function (synctype) {
  const selectedNode = rcmail.addressbooks_list.get_selection()
  if (selectedNode.startsWith('_abook')) {
    const abookid = selectedNode.substr(6)
    const lock = this.display_message(rcmail.get_label(synctype + '_msg_inprogress', 'carddav'), 'loading')
    this.http_request('plugin.carddav.AbSync', { abookid, synctype }, lock, 'GET')
  }
}

// vim: ts=2:sw=2:expandtab:fenc=utf8:ff=unix:tw=120
