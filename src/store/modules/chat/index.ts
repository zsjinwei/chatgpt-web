import { defineStore } from 'pinia'
import { getLocalState, setLocalState } from './helper'
import { router } from '@/router'
import { fetchClearChat, fetchCreateChatRoom, fetchDeleteChat, fetchDeleteChatRoom, fetchGetChatHistory, fetchGetChatRooms, fetchRenameChatRoom } from '@/api'

export const useChatStore = defineStore('chat-store', {
  state: (): Chat.ChatState => getLocalState(),

  getters: {
    getChatHistoryByCurrentActive(state: Chat.ChatState) {
      const index = state.history.findIndex(item => item.uuid === state.active)
      if (index !== -1)
        return state.history[index]
      return null
    },

    getChatByUuid(state: Chat.ChatState) {
      return (uuid?: number) => {
        if (uuid)
          return state.chat.find(item => item.uuid === uuid)?.data ?? []
        return state.chat.find(item => item.uuid === state.active)?.data ?? []
      }
    },
  },

  actions: {
    async syncHistory() {
      const rooms = (await fetchGetChatRooms()).data
      // if (rooms.length <= 0)
      //   return

      let uuid = null
      this.history = []
      this.chat = []
      await rooms.forEach(async (r: Chat.History) => {
        this.history.unshift(r)
        uuid = r.uuid
        const chatData = (await fetchGetChatHistory(r.uuid)).data
        this.chat.unshift({ uuid: r.uuid, data: chatData })
      })
      if (uuid == null) {
        uuid = Date.now()
        this.addHistory({ title: 'New Chat', uuid: Date.now(), isEdit: false })
      }

      this.active = uuid
      this.reloadRoute(uuid)
    },

    addHistory(history: Chat.History, chatData: Chat.Chat[] = []) {
      fetchCreateChatRoom(history.title, history.uuid)
      this.history.unshift(history)
      this.chat.unshift({ uuid: history.uuid, data: chatData })
      this.active = history.uuid
      this.reloadRoute(history.uuid)
    },

    updateHistory(uuid: number, edit: Partial<Chat.History>) {
      const index = this.history.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        this.history[index] = { ...this.history[index], ...edit }
        this.recordState()
        fetchRenameChatRoom(this.history[index].title, this.history[index].uuid)
      }
    },

    async deleteHistory(index: number) {
      fetchDeleteChatRoom(this.history[index].uuid)
      this.history.splice(index, 1)
      this.chat.splice(index, 1)

      if (this.history.length === 0) {
        this.active = null
        this.reloadRoute()
        return
      }

      if (index > 0 && index <= this.history.length) {
        const uuid = this.history[index - 1].uuid
        this.active = uuid
        this.reloadRoute(uuid)
        return
      }

      if (index === 0) {
        if (this.history.length > 0) {
          const uuid = this.history[0].uuid
          this.active = uuid
          this.reloadRoute(uuid)
        }
      }

      if (index > this.history.length) {
        const uuid = this.history[this.history.length - 1].uuid
        this.active = uuid
        this.reloadRoute(uuid)
      }
    },

    async setActive(uuid: number) {
      this.active = uuid
      return await this.reloadRoute(uuid)
    },

    getChatByUuidAndIndex(uuid: number, index: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length)
          return this.chat[0].data[index]
        return null
      }
      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1)
        return this.chat[chatIndex].data[index]
      return null
    },

    addChatByUuid(uuid: number, chat: Chat.Chat) {
      if (!uuid || uuid === 0) {
        if (this.history.length === 0) {
          const uuid = Date.now()
          fetchCreateChatRoom(chat.text, uuid)
          this.history.push({ uuid, title: chat.text, isEdit: false })
          this.chat.push({ uuid, data: [chat] })
          this.active = uuid
          this.recordState()
        }
        else {
          this.chat[0].data.push(chat)
          if (this.history[0].title === 'New Chat') {
            this.history[0].title = chat.text
            fetchRenameChatRoom(chat.text, this.history[0].uuid)
          }
          this.recordState()
        }
      }

      const index = this.chat.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        this.chat[index].data.push(chat)
        if (this.history[index].title === 'New Chat') {
          this.history[index].title = chat.text
          fetchRenameChatRoom(chat.text, this.history[index].uuid)
        }
        this.recordState()
      }
    },

    updateChatByUuid(uuid: number, index: number, chat: Chat.Chat) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          chat.uuid = this.chat[0].data[index].uuid
          this.chat[0].data[index] = chat
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        chat.uuid = this.chat[chatIndex].data[index].uuid
        this.chat[chatIndex].data[index] = chat
        this.recordState()
      }
    },

    updateChatSomeByUuid(uuid: number, index: number, chat: Partial<Chat.Chat>) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          chat.uuid = this.chat[0].data[index].uuid
          this.chat[0].data[index] = { ...this.chat[0].data[index], ...chat }
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        chat.uuid = this.chat[chatIndex].data[index].uuid
        this.chat[chatIndex].data[index] = { ...this.chat[chatIndex].data[index], ...chat }
        this.recordState()
      }
    },

    deleteChatByUuid(uuid: number, index: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          fetchDeleteChat(uuid, this.chat[0].data[index].uuid || 0, this.chat[0].data[index].inversion)
          this.chat[0].data.splice(index, 1)
          this.recordState()
        }
        return
      }

      const chatIndex = this.chat.findIndex(item => item.uuid === uuid)
      if (chatIndex !== -1) {
        fetchDeleteChat(uuid, this.chat[chatIndex].data[index].uuid || 0, this.chat[0].data[index].inversion)
        this.chat[chatIndex].data.splice(index, 1)
        this.recordState()
      }
    },

    clearChatByUuid(uuid: number) {
      if (!uuid || uuid === 0) {
        if (this.chat.length) {
          fetchClearChat(this.chat[0].uuid)
          this.chat[0].data = []
          this.history[0].title = 'New Chat'
          this.recordState()
        }
        return
      }

      const index = this.chat.findIndex(item => item.uuid === uuid)
      if (index !== -1) {
        fetchClearChat(uuid)
        this.chat[index].data = []
        this.history[index].title = 'New Chat'
        this.recordState()
      }
    },

    async reloadRoute(uuid?: number) {
      this.recordState()
      await router.push({ name: 'Chat', params: { uuid } })
    },

    recordState() {
      setLocalState(this.$state)
    },
  },
})
