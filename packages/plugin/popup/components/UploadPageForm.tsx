import { Input } from '@web-archive/shared/components/input'
import { Label } from '@web-archive/shared/components/label'
import type { PageType } from 'popup/PopupPage'
import type { ChangeEvent } from 'react'
import { useState } from 'react'
import { sendMessage } from 'webext-bridge/popup'
import { Textarea } from '@web-archive/shared/components/textarea'
import { Button } from '@web-archive/shared/components/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@web-archive/shared/components/select'
import { useRequest } from 'ahooks'
import { isNil } from '@web-archive/shared/utils'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSingleFileSetting } from '~/popup/utils/singleFile'
import { takeScreenshot } from '~/popup/utils/screenshot'
import { getCurrentTab } from '~/popup/utils/tab'
import LoadingPage from '~/popup/components/LoadingPage'

interface UploadPageFormProps {
  setActivePage: (page: PageType) => void
}

async function scrapePageData() {
  const tab = await getCurrentTab()

  if (!tab?.id) {
    return {
      title: '',
      pageDesc: '',
      href: '',
      screenshot: undefined,
    }
  }

  const [pageData, screenshot] = await Promise.all([
    sendMessage('get-basic-page-data', {}, `content-script@${tab.id}`),
    takeScreenshot(tab.windowId),
  ])

  return {
    title: pageData.title,
    pageDesc: pageData.pageDesc,
    href: pageData.href,
    screenshot,
  }
}

async function getAllFolders() {
  const { folders } = await sendMessage('get-all-folders', {})
  return folders
}

function UploadPageForm({ setActivePage }: UploadPageFormProps) {
  const lastChooseFolderId = localStorage.getItem('lastChooseFolderId') || undefined
  const [uploadPageData, setUploadPageData] = useState({
    title: '',
    pageDesc: '',
    href: '',
    folderId: lastChooseFolderId,
    screenshot: undefined as undefined | string,
  })

  const { data: folderList, loading: loadingFolder } = useRequest(getAllFolders, {
    cacheKey: 'folderList',
  })

  function handleChange(e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement> | ChangeEvent<HTMLSelectElement>) {
    const { name, value } = e.target
    setUploadPageData(prevData => ({
      ...prevData,
      [name]: value,
    }))
  }

  function handleFolderSelect(newFolder: string) {
    localStorage.setItem('lastChooseFolderId', newFolder)
    setUploadPageData(prevData => ({
      ...prevData,
      folderId: newFolder,
    }))
  }

  const { loading: isInitPageData } = useRequest(
    scrapePageData,
    {
      onSuccess: (data) => {
        setUploadPageData({
          ...uploadPageData,
          ...data,
        })
      },
    },
  )

  function handleCancle() {
    setActivePage('home')
  }

  async function handleSavePage() {
    // todo await folderlist to check folder extists?
    if (isNil(uploadPageData.folderId)) {
      toast.error('Please select a folder')
      return
    }
    const tab = await getCurrentTab()
    if (isNil(tab.id)) {
      toast.error('Can not get current tab info')
      return
    }
    await sendMessage('add-save-page-task', {
      tabId: tab.id,
      singleFileSetting: getSingleFileSetting(),
      pageForm: {
        title: uploadPageData.title,
        pageDesc: uploadPageData.pageDesc,
        href: uploadPageData.href,
        folderId: uploadPageData.folderId,
        screenshot: uploadPageData.screenshot,
      },
    })
    toast.success('Add save page task success')
    setActivePage('home')
  }

  if (isInitPageData) {
    return (
      <LoadingPage
        loadingText="Scraping Page Data..."
      />
    )
  }

  return (
    <div className="w-64 p-4 space-y-4 flex flex-col">
      <div className="flex flex-col space-y-2">
        <Label
          htmlFor="title"
        >
          Title
        </Label>
        <Input
          type="text"
          id="title"
          name="title"
          value={uploadPageData.title}
          onChange={handleChange}
        />
      </div>

      <div className="flex flex-col space-y-2">
        <Label
          htmlFor="pageDesc"
        >
          Page Description
        </Label>
        <Textarea
          id="pageDesc"
          name="pageDesc"
          value={uploadPageData.pageDesc}
          rows={3}
          onChange={handleChange}
        >
        </Textarea>
      </div>

      <div className="flex flex-col space-y-2">
        <Label
          htmlFor="folderId"
        >
          Folder
        </Label>
        <Select
          name="folderId"
          value={uploadPageData.folderId}
          onValueChange={handleFolderSelect}
        >
          <SelectTrigger>
            <SelectValue placeholder="select folder"></SelectValue>
          </SelectTrigger>
          <SelectContent>
            {folderList && folderList.map(folder => (
              <SelectItem key={folder.id} value={folder.id.toString()}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between">
        <Button
          onClick={handleCancle}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          disabled={isNil(uploadPageData.folderId)}
          onClick={handleSavePage}
        >
          {
            (isNil(folderList) && loadingFolder)
              ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin"></Loader2>
                  Loading
                </span>
                )
              : (
                  'Confirm'
                )
          }
        </Button>
      </div>
    </div>
  )
}

export default UploadPageForm
